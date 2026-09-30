import { isLive, isPostSlug } from "@/features/blog/blog"
import type { ManagedPost, PostStatus } from "@/features/blog/hooks/use-blog"

/**
 * Turning what Sanity holds into what the console's Blog page lists. Pure, so
 * every rule about a post's state is tested without Sanity.
 *
 * Sanity keeps a post as up to two documents: the published one under its id,
 * and a draft under "drafts.<id>" - the only one there is until the post is
 * first published, and afterwards the edits not yet published.
 */

/** A post document, draft or published, with the fields the console needs. */
export type RawPost = {
  _id: string
  _updatedAt: string
  title?: string | null
  slug?: string | null
  excerpt?: string | null
  category?: string | null
  publishedAt?: string | null
  author?: string | null
  hasCover?: boolean | null
  hasBody?: boolean | null
}

const DRAFT = "drafts."

export const draftIdOf = (id: string) => `${DRAFT}${id}`

/**
 * What a draft still needs before it may be published. The Studio checks the
 * same things on its own Publish button; publishing from the console goes
 * round the Studio, so they are checked here.
 */
export function missingFor(post: RawPost): string[] {
  const missing: string[] = []
  if (!post.title?.trim()) missing.push("a title")
  if (!post.slug) missing.push("a slug")
  else if (!isPostSlug(post.slug)) {
    missing.push("a slug of lower-case letters, numbers and hyphens")
  }
  if (!post.excerpt?.trim()) missing.push("an excerpt")
  if (!post.category) missing.push("a category")
  if (!post.hasCover) missing.push("a cover image")
  if (!post.hasBody) missing.push("a body")
  return missing
}

/** "a title", "a title and a body", "a title, a slug and a body". */
export function listOf(items: string[]): string {
  if (items.length <= 1) return items.join("")
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`
}

/** One post from its two documents, either of which may be absent - but not both. */
export function managedPost(
  id: string,
  draft: RawPost | null,
  published: RawPost | null,
  now: number = Date.now(),
): ManagedPost {
  // What the editor sees in the Studio is the draft when there is one.
  const latest = (draft ?? published)!
  const status: PostStatus = !published
    ? "DRAFT"
    : isLive(published.publishedAt, now)
      ? "LIVE"
      : "SCHEDULED"

  return {
    id,
    title: latest.title?.trim() || "Untitled",
    slug: latest.slug ?? null,
    category: latest.category ?? null,
    author: latest.author ?? null,
    status,
    // The date in force is the published document's; a draft's is what it
    // would be published with.
    publishedAt: (published ?? latest).publishedAt ?? null,
    hasChanges: Boolean(draft && published),
    missing: draft ? missingFor(draft) : [],
    updatedAt: latest._updatedAt,
  }
}

/**
 * Every post, newest edit first. Documents of Sanity's other namespaces -
 * "versions.<release>.<id>", which the free plan does not have - are not posts
 * of their own and are left out.
 */
export function managedPosts(docs: RawPost[], now: number = Date.now()): ManagedPost[] {
  const pairs = new Map<string, { draft: RawPost | null; published: RawPost | null }>()
  for (const doc of docs) {
    const isDraft = doc._id.startsWith(DRAFT)
    const id = isDraft ? doc._id.slice(DRAFT.length) : doc._id
    if (id.includes(".")) continue
    const pair = pairs.get(id) ?? { draft: null, published: null }
    if (isDraft) pair.draft = doc
    else pair.published = doc
    pairs.set(id, pair)
  }
  return [...pairs.entries()]
    .map(([id, pair]) => managedPost(id, pair.draft, pair.published, now))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}
