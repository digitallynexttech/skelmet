import { isLive, isPostSlug } from "@/features/blog/blog"
import { apiVersion, dataset, projectId, sanityConfigured } from "@/features/blog/sanity/env"

/**
 * Lets proxy.ts answer 404 for a /blog/<slug> that is not a post. The page keeps unknown slugs open
 * for new posts, so without this a crawler walking random slugs could fill the page cache.
 * Slugs are read once a minute, or every ten seconds while an unknown one is asked for. Dates are
 * checked at ask time, so a scheduled post becomes known at its moment.
 */

const FRESH_MS = 60_000
/** How soon an unknown address may trigger another read. */
const RECHECK_MS = 10_000
const TIMEOUT_MS = 3_000

const SLUGS_QUERY = `*[_type == "post" && defined(slug.current)]{ "slug": slug.current, publishedAt }`

/** Each published post's slug and publishedAt. */
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
      // A failed read keeps the old list: an outage must not 404 every post.
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

  // No project, or a slug the Studio could not have made.
  if (!sanityConfigured || !isPostSlug(slug)) return true

  const live = (known: Known) => isLive(known.posts.get(slug))

  let known = await knownPosts(FRESH_MS)
  if (known && !live(known)) known = await knownPosts(RECHECK_MS)
  // Sanity has never answered: let the page decide.
  if (!known) return false
  return !live(known)
}
