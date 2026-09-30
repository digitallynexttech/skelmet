import { isLive, isPostSlug } from "@/features/blog/blog"
import { apiVersion, dataset, projectId, sanityConfigured } from "@/features/blog/sanity/env"

/**
 * Whether a /blog/<slug> URL is a post that does not exist, for proxy.ts to
 * answer 404 before anything renders - as lib/known-pages.ts does for
 * products and policies.
 *
 * The post page cannot do it alone. It keeps unknown slugs open so a post
 * published in the Studio appears without a deploy, which means every made-up
 * address would be rendered, asked of Sanity and kept in the page cache: a
 * crawler walking random slugs could fill the disk.
 *
 * So the proxy holds the list of addresses that do exist, read from Sanity at
 * most once a minute - or once every ten seconds while someone is asking for
 * one it has not heard of, so a post published a moment ago is not refused
 * for a minute. Plain fetch, not the Sanity client: this runs in the proxy,
 * ahead of every blog request, and needs one query.
 *
 * Each address is kept with its date, and the date is checked when it is
 * asked for: a scheduled post is unknown until its moment and known from
 * then on, with nothing having to tell the proxy.
 */

const FRESH_MS = 60_000
/** How soon an unknown address may send it back to Sanity to look again. */
const RECHECK_MS = 10_000
const TIMEOUT_MS = 3_000

const SLUGS_QUERY = `*[_type == "post" && defined(slug.current)]{ "slug": slug.current, publishedAt }`

/** Each published post's address, and when it goes - or went - live. */
type Known = { posts: Map<string, string | null>; at: number }

const shared = globalThis as unknown as {
  skelmetKnownPosts?: { known: Known | null; reading: Promise<Known | null> | null }
}
const state = (shared.skelmetKnownPosts ??= { known: null, reading: null })

async function readSlugs(): Promise<Known | null> {
  const token = process.env.SANITY_API_TOKEN || undefined
  // The API CDN for a public dataset; the API itself when a token is needed.
  const host = token ? "api.sanity.io" : "apicdn.sanity.io"
  const url = new URL(`https://${projectId}.${host}/v${apiVersion}/data/query/${dataset}`)
  url.searchParams.set("query", SLUGS_QUERY)
  url.searchParams.set("perspective", "published")
  try {
    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    })
    if (!res.ok) return null
    const body = (await res.json()) as { result?: unknown }
    if (!Array.isArray(body.result)) return null
    const posts = new Map<string, string | null>()
    for (const row of body.result as Array<{ slug?: unknown; publishedAt?: unknown }>) {
      if (typeof row?.slug !== "string") continue
      posts.set(row.slug, typeof row.publishedAt === "string" ? row.publishedAt : null)
    }
    return { posts, at: Date.now() }
  } catch {
    return null
  }
}

/** The list, refreshed when it is older than `maxAge`. One read at a time. */
async function knownPosts(maxAge: number): Promise<Known | null> {
  if (state.known && Date.now() - state.known.at < maxAge) return state.known
  state.reading ??= readSlugs()
    .then((fresh) => {
      // A failed read keeps the list it had: a Sanity outage must not turn
      // every post into a 404.
      if (fresh) state.known = fresh
      return state.known
    })
    .finally(() => {
      state.reading = null
    })
  return state.reading
}

/** For tests: forget the list. */
export function forgetKnownPosts(): void {
  state.known = null
  state.reading = null
}

export async function isUnknownPost(pathname: string): Promise<boolean> {
  const parts = pathname.split("/")
  // Only /blog/<slug> itself: /blog is the list, and nothing lives deeper.
  if (parts.length !== 3 || parts[1] !== "blog" || !parts[2]) return false
  const slug = parts[2]

  // No project, so no posts; and an address no slug field could have made.
  if (!sanityConfigured || !isPostSlug(slug)) return true

  const live = (known: Known) => isLive(known.posts.get(slug))

  let known = await knownPosts(FRESH_MS)
  if (known && !live(known)) known = await knownPosts(RECHECK_MS)
  // Sanity has never answered: let the page decide, as it would have.
  if (!known) return false
  return !live(known)
}
