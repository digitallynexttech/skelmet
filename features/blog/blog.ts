/**
 * The blog's shapes and small pure helpers. Client-safe, and free of imports:
 * the post cards run in the browser, and the Studio's schema reads the
 * category list from here, through the Sanity CLI, which knows no path alias.
 */

/**
 * What a post can be filed under. The Studio offers these and the blog page
 * filters by them; a post filed under one that has since been removed falls
 * back to a plain "Blog" label rather than disappearing.
 */
export const BLOG_CATEGORIES = [
  { value: "helmet-care", label: "Helmet care" },
  { value: "riding", label: "Riding" },
  { value: "garage", label: "Garage & gear" },
  { value: "behind-the-build", label: "Behind the build" },
  { value: "news", label: "News" },
] as const

export type BlogCategory = (typeof BLOG_CATEGORIES)[number]["value"]

export function categoryLabel(value?: string | null): string {
  return BLOG_CATEGORIES.find((c) => c.value === value)?.label ?? "Blog"
}

/** An image as Sanity stores it: a reference to the file, and how to crop it. */
export type SanityImage = {
  asset?: { _ref: string; _type?: string }
  alt?: string
  caption?: string
  hotspot?: { x: number; y: number; height?: number; width?: number }
  crop?: { top: number; bottom: number; left: number; right: number }
}

export type BlogAuthor = {
  name?: string
  role?: string
  bio?: string
  photo?: SanityImage
}

/** A post as the blog page lists it. */
export type BlogListItem = {
  _id: string
  title: string
  slug: string
  excerpt?: string
  category?: string
  coverImage?: SanityImage
  publishedAt?: string
  /** When the document last changed in Sanity: the sitemap's lastModified. */
  updatedAt?: string
  featured?: boolean
  /** Worked out from the length of the body, never typed in. */
  readMinutes?: number
  author?: BlogAuthor | null
}

/** One node of a Portable Text body. Kept open: the renderer maps the types it knows. */
export type PortableBlock = {
  _type: string
  _key?: string
  [key: string]: unknown
}

export type BlogPost = BlogListItem & { body?: PortableBlock[] }

/** A heading in a post's body, for the "On this page" list. */
export type BlogHeading = {
  /** The block's _key, which is how the rendered heading finds its id. */
  key: string
  /** The anchor: a slug of the text, numbered when two headings share one. */
  id: string
  text: string
  level: 2 | 3
}

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "section"
  )
}

/** The headings of a body, in order, each with an anchor id that is unique on the page. */
export function extractHeadings(body?: PortableBlock[]): BlogHeading[] {
  const out: BlogHeading[] = []
  const seen = new Map<string, number>()
  for (const block of body ?? []) {
    if (block._type !== "block") continue
    if (block.style !== "h2" && block.style !== "h3") continue
    const children = (block.children as Array<{ text?: string }> | undefined) ?? []
    const text = children
      .map((c) => c?.text ?? "")
      .join("")
      .trim()
    if (!text) continue

    const base = slugify(text)
    const count = seen.get(base) ?? 0
    seen.set(base, count + 1)
    const id = count === 0 ? base : `${base}-${count + 1}`
    out.push({ key: block._key || id, id, text, level: block.style === "h2" ? 2 : 3 })
  }
  return out
}

/** "30 September 2026", on India's calendar. Empty for a missing or unreadable date. */
export function formatPostDate(iso?: string | null): string {
  if (!iso) return ""
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  })
}

/**
 * Whether a published post is on the site yet. A post published with a date
 * still to come is scheduled: it is in Sanity, and nowhere on the site until
 * that moment - which is the whole of how scheduling works here, with no
 * timer to fire. A post with no readable date is not live.
 */
export function isLive(publishedAt: string | null | undefined, now: number = Date.now()): boolean {
  const at = Date.parse(publishedAt ?? "")
  return Number.isFinite(at) && at <= now
}

/**
 * What a post's address may look like: lower-case words joined by hyphens,
 * which is what the Studio's slug field produces. Anything else is not a
 * post, and can be refused without asking Sanity.
 */
export function isPostSlug(slug: string): boolean {
  return slug.length <= 96 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
}
