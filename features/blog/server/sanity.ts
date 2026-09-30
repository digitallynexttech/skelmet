import "server-only"

import { createClient, type QueryParams } from "next-sanity"

import { isLive, type BlogListItem, type BlogPost } from "@/features/blog/blog"
import { apiVersion, dataset, projectId, sanityConfigured } from "@/features/blog/sanity/env"

/**
 * Reading posts from Sanity.
 *
 * Every read is cached by Next for BLOG_REVALIDATE seconds, so a post
 * published in the Studio is on the site within a minute, without a deploy,
 * and Sanity is asked at most once a minute per query however many people
 * are reading. The console's Blog page clears that cache when it publishes.
 *
 * A post dated in the future is scheduled, and is left out here rather than
 * in the query: a query that asked Sanity for "before now" would be answered
 * from its CDN's copy, which no clock invalidates, and the post would not
 * appear on time. So Sanity is asked for every published post and the date is
 * checked each time a page is rendered.
 *
 * Without a Sanity project (config/site.ts) every read answers as if there
 * were no posts, so the blog shows its empty state rather than failing. A
 * project that cannot be reached still rejects: that is for the page to
 * catch, since only it knows what to show instead.
 */

/** How long a page may go on showing what it last read, seconds. */
export const BLOG_REVALIDATE = 60

// A public dataset needs no token, and is read through Sanity's API CDN. A
// private one is read with SANITY_API_TOKEN - server-only, so it never
// reaches the browser - and straight from the API, which is the only place a
// token is honoured.
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
    // Drafts are the Studio's business; the site only ever shows what was published.
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

/**
 * A post as the cards show it. The read time is the body's length at about
 * 200 words a minute (1,100 characters), never less than one.
 */
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
