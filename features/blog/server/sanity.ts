import "server-only"

import { createClient, type QueryParams } from "next-sanity"

import { isLive, type BlogListItem, type BlogPost } from "@/features/blog/blog"
import { apiVersion, dataset, projectId, sanityConfigured } from "@/features/blog/sanity/env"

// Posts from Sanity, cached by Next for BLOG_REVALIDATE seconds; the console clears it on publish.
// Future-dated posts are dropped here, not in the query: Sanity's CDN would cache "before now".
// Without a Sanity project every read is empty; an unreachable one still rejects.

/** Seconds a page may show what it last read. */
export const BLOG_REVALIDATE = 60

// A public dataset is read through the CDN; with the server-only token, straight from the API,
// the only place a token is honoured.
const token = process.env.SANITY_API_TOKEN || undefined

let client: ReturnType<typeof createClient> | null = null

function getClient() {
  if (!sanityConfigured) return null
  client ??= createClient({
    projectId,
    dataset,
    apiVersion,
    token,
    useCdn: !token,
    // The site never shows drafts.
    perspective: "published",
  })
  return client
}

async function read<T>(query: string, params: QueryParams, fallback: T): Promise<T> {
  const sanity = getClient()
  if (!sanity) return fallback
  return sanity.fetch<T>(query, params, { next: { revalidate: BLOG_REVALIDATE, tags: ["blog"] } })
}

// ── queries ────────────────────────────────────────────────

/** A published post with an address. Whether its date has come is checked here, not there. */
const PUBLISHED = `_type == "post" && defined(slug.current)`

/** A post as the cards show it. Read time: about 200 words (1,100 characters) a minute, min 1. */
const CARD = `
  _id,
  title,
  "slug": slug.current,
  excerpt,
  category,
  coverImage,
  publishedAt,
  "updatedAt": _updatedAt,
  featured,
  "readMinutes": math::max([1, round(length(pt::text(body)) / 1100)]),
  "author": author->{ name, role, photo }
`

const LIST_QUERY = `*[${PUBLISHED}] | order(publishedAt desc) { ${CARD} }`

const POST_QUERY = `*[${PUBLISHED} && slug.current == $slug][0] {
  ${CARD},
  body,
  "author": author->{ name, role, bio, photo }
}`

// ── reads ──────────────────────────────────────────────────

/** Every post that is live, newest first. */
export async function getBlogPosts(): Promise<BlogListItem[]> {
  const posts = await read<BlogListItem[]>(LIST_QUERY, {}, [])
  return posts.filter((post) => isLive(post.publishedAt))
}

/** One live post with its body, or null when there is none at that address. */
export async function getBlogPost(slug: string): Promise<BlogPost | null> {
  const post = await read<BlogPost | null>(POST_QUERY, { slug }, null)
  return post && isLive(post.publishedAt) ? post : null
}

/** The address of every live post: what gets prerendered. */
export async function getBlogSlugs(): Promise<string[]> {
  return (await getBlogPosts()).map((post) => post.slug)
}
