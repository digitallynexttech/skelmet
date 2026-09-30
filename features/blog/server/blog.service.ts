import "server-only"

import { revalidateTag } from "next/cache"
import { createClient } from "next-sanity"

import { isLive } from "@/features/blog/blog"
import type { ManagedPost, ManagedPosts, PostStatus } from "@/features/blog/hooks/use-blog"
import {
  draftIdOf,
  listOf,
  managedPost,
  managedPosts,
  missingFor,
  type RawPost,
} from "@/features/blog/lib/managed-posts"
import { apiVersion, dataset, projectId, sanityConfigured } from "@/features/blog/sanity/env"
import { postIdSchema, schedulePostSchema } from "@/features/blog/schemas/post.schema"
import { PERMISSIONS } from "@/lib/constants"
import { createAuditLog, getAuditMeta } from "@/server/audit"
import { fail, ok, runAction, type ActionResult } from "@/server/action-result"
import { can, requirePermission } from "@/server/action-guard"

/**
 * The console's Blog page: every post with where it stands, and the three
 * things staff do to one - publish it, schedule it, take it down.
 *
 * Posts are written in the Studio (/studio). This is the desk they are
 * released from, and it exists for scheduling, which Sanity sells as a paid
 * feature. Here it costs nothing, because nothing has to run at the chosen
 * time: a scheduled post is published in Sanity straight away with a date
 * still to come, and the site leaves out any post whose date has not arrived
 * (isLive). The moment it passes, the post is simply there.
 *
 * Publishing from here goes round the Studio, and so round the checks its own
 * Publish button makes. They are made again in missingFor, so a post with no
 * cover or no body cannot reach the site from either side.
 *
 * Everything needs SANITY_API_TOKEN: drafts are private even in a public
 * dataset, and publishing is a write.
 */

const NOT_SET_UP =
  "The blog has no Sanity project yet. Put its id in config/site.ts, under sanity.projectId."
const NO_TOKEN =
  "Managing posts from here needs SANITY_API_TOKEN in the server's .env: a token with the Editor role, from sanity.io/manage > API > Tokens."

/** A draft or published post, with what the console lists and checks. */
const FIELDS = `
  _id,
  _updatedAt,
  title,
  "slug": slug.current,
  excerpt,
  category,
  publishedAt,
  "author": author->name,
  "hasCover": defined(coverImage.asset),
  "hasBody": count(body) > 0
`
const ALL_POSTS = `*[_type == "post"]{ ${FIELDS} }`
const ONE_POST = `*[_type == "post" && _id in [$id, $draftId]]{ ${FIELDS} }`
/** Other published posts at this address. A draft elsewhere is not a clash until it is published. */
const SLUG_TAKEN = `count(*[_type == "post" && slug.current == $slug && !(_id in [$id, $draftId]) && !(_id in path("drafts.**"))])`

type Editor = ReturnType<typeof createClient>

let editor: Editor | null = null

/** The Sanity client that may read drafts and write, or why there is none. */
function getEditor(): Editor | ActionResult<never> {
  if (!sanityConfigured) return fail(NOT_SET_UP, undefined, 503)
  const token = process.env.SANITY_API_TOKEN
  if (!token) return fail(NO_TOKEN, undefined, 503)
  editor ??= createClient({ projectId, dataset, apiVersion, token, useCdn: false })
  return editor
}

const isFailure = (value: Editor | ActionResult<never>): value is ActionResult<never> =>
  "ok" in value

/** Drafts and published documents alike, and never from a cache. */
const RAW = { perspective: "raw", cache: "no-store" } as const

/** What Sanity said when it refused, as a failure staff can act on. */
function sanityFailure(err: unknown): ActionResult<never> {
  console.error("[BLOG] Sanity refused", err)
  const status = (err as { statusCode?: unknown }).statusCode
  if (status === 401 || status === 403) {
    return fail(
      "Sanity refused: the token on the server is not allowed to do that. It needs the Editor role.",
      undefined,
      502,
    )
  }
  const detail = err instanceof Error ? err.message.split("\n")[0] : ""
  return fail(
    `Sanity did not make the change${detail ? `: ${detail}` : "."} Nothing was published.`,
    undefined,
    502,
  )
}

/**
 * Drops what the site has cached of the blog, so a post published or taken
 * down here is seen - or gone - on the next visit rather than in a minute.
 */
function refreshBlog(): void {
  try {
    revalidateTag("blog", { expire: 0 })
  } catch (err) {
    // Outside a request - a test - there is no cache to clear.
    console.warn("[BLOG] site cache not cleared", err)
  }
}

/** A post's two documents, either of which may not exist. */
async function loadPost(sanity: Editor, id: string) {
  const draftId = draftIdOf(id)
  const docs = await sanity.fetch<RawPost[]>(ONE_POST, { id, draftId }, RAW)
  return {
    draftId,
    draft: docs.find((d) => d._id === draftId) ?? null,
    published: docs.find((d) => d._id === id) ?? null,
  }
}

/** Why a draft may not go out, or null when it may. */
async function refusal(
  sanity: Editor,
  id: string,
  draftId: string,
  draft: RawPost,
): Promise<ActionResult<never> | null> {
  const missing = missingFor(draft)
  if (missing.length > 0) {
    return fail(
      `This post cannot be published yet: it needs ${listOf(missing)}. Finish it in the Studio.`,
      { missing },
      422,
    )
  }
  const taken = await sanity.fetch<number>(SLUG_TAKEN, { slug: draft.slug!, id, draftId }, RAW)
  if (taken > 0) {
    return fail(
      `Another published post already has the address /blog/${draft.slug}. Change this one's slug in the Studio.`,
      undefined,
      409,
    )
  }
  return null
}

// ── reading ─────────────────────────────────────────────────

export async function listManagedPosts(): Promise<ActionResult<ManagedPosts>> {
  return runAction(async () => {
    const session = await requirePermission(PERMISSIONS.POST_READ)
    const sanity = getEditor()
    if (isFailure(sanity)) return sanity

    let docs: RawPost[]
    try {
      docs = await sanity.fetch<RawPost[]>(ALL_POSTS, {}, RAW)
    } catch (err) {
      console.error("[BLOG] could not read the posts", err)
      return fail("Sanity could not be reached. Try again in a moment.", undefined, 502)
    }

    const data = managedPosts(docs)
    const counts: Record<PostStatus, number> = { DRAFT: 0, SCHEDULED: 0, LIVE: 0 }
    for (const post of data) counts[post.status] += 1
    return ok({ data, counts, canPublish: can(session, PERMISSIONS.POST_PUBLISH) })
  })
}

// ── releasing ───────────────────────────────────────────────

type Released = Pick<ManagedPost, "id" | "status">

/**
 * Publishes a post with `at` as its date, which decides whether it is live or
 * scheduled.
 *
 * With a draft, the date is written onto it and the draft is published, in
 * one transaction - so edits waiting in the draft go out with it. A post that
 * is already published and has no draft only has its date moved.
 *
 * `keepDate` is for publishing edits to a post that is already live: it keeps
 * the date it first went out with rather than jumping to the top of the blog.
 */
async function release(
  rawId: string,
  at: string,
  how: "publish" | "schedule",
): Promise<ActionResult<Released>> {
  const session = await requirePermission(PERMISSIONS.POST_PUBLISH)
  const id = postIdSchema.parse(rawId)
  const sanity = getEditor()
  if (isFailure(sanity)) return sanity

  let status: PostStatus
  try {
    const { draftId, draft, published } = await loadPost(sanity, id)
    if (!draft && !published) return fail("Post not found.", undefined, 404)

    if (draft) {
      const refused = await refusal(sanity, id, draftId, draft)
      if (refused) return refused

      const keepDate = how === "publish" && Boolean(published) && isLive(draft.publishedAt)
      await sanity.action([
        ...(keepDate
          ? []
          : [
              {
                actionType: "sanity.action.document.edit" as const,
                draftId,
                publishedId: id,
                patch: { set: { publishedAt: at } },
              },
            ]),
        { actionType: "sanity.action.document.publish" as const, draftId, publishedId: id },
      ])
      status = managedPost(id, null, {
        ...draft,
        _id: id,
        publishedAt: keepDate ? draft.publishedAt : at,
      }).status
    } else {
      if (how === "publish" && isLive(published!.publishedAt)) {
        return fail("That post is already on the site.", undefined, 409)
      }
      await sanity.patch(id).set({ publishedAt: at }).commit()
      status = managedPost(id, null, { ...published!, publishedAt: at }).status
    }
  } catch (err) {
    return sanityFailure(err)
  }

  refreshBlog()
  await createAuditLog(session, {
    action: `post:${how}`,
    module: "post",
    entityId: id,
    meta: { at, status },
    ...(await getAuditMeta()),
  })
  return ok({ id, status })
}

/** Puts a post on the site now. */
export async function publishPost(id: string): Promise<ActionResult<Released>> {
  return runAction(() => release(id, new Date().toISOString(), "publish"))
}

/** Publishes a post to go on the site at a time still to come. */
export async function schedulePost(id: string, raw: unknown): Promise<ActionResult<Released>> {
  return runAction(async () => {
    const { at } = schedulePostSchema.parse(raw)
    return release(id, new Date(at).toISOString(), "schedule")
  })
}

/**
 * Takes a post off the site, live or scheduled, and keeps it as a draft: the
 * writing is not lost, and it can be published again.
 */
export async function unpublishPost(rawId: string): Promise<ActionResult<Released>> {
  return runAction(async () => {
    const session = await requirePermission(PERMISSIONS.POST_PUBLISH)
    const id = postIdSchema.parse(rawId)
    const sanity = getEditor()
    if (isFailure(sanity)) return sanity

    try {
      const { draftId, draft, published } = await loadPost(sanity, id)
      if (!draft && !published) return fail("Post not found.", undefined, 404)
      if (!published) return fail("That post is not published.", undefined, 409)

      await sanity.action({
        actionType: "sanity.action.document.unpublish",
        draftId,
        publishedId: id,
      })
    } catch (err) {
      return sanityFailure(err)
    }

    refreshBlog()
    await createAuditLog(session, {
      action: "post:unpublish",
      module: "post",
      entityId: id,
      ...(await getAuditMeta()),
    })
    return ok({ id, status: "DRAFT" as const })
  })
}
