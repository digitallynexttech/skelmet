import type { MetadataRoute } from "next"

import { siteConfig } from "@/lib/config/site"
import type { BlogListItem } from "@/features/blog/blog"
import { getBlogPosts } from "@/features/blog/server/sanity"
import { PRODUCTS } from "@/features/catalog/catalog"
import { POLICIES } from "@/features/policies/policies"

// When each page's content last changed: bump by hand. Never `new Date()`, or crawlers
// learn to ignore lastModified. Policies carry their own date.
const UPDATED = {
  home: "2026-09-28",
  about: "2026-09-28",
  contact: "2026-09-28",
  riders: "2026-09-28",
  faq: "2026-09-28",
  track: "2026-09-28",
  product: "2026-09-28",
  products: "2026-10-08",
}

// Hourly: how soon a new post is listed.
export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const url = (path: string) => `${siteConfig.url}${path}`
  const on = (iso: string) => new Date(`${iso}T00:00:00Z`)

  // An unreachable Sanity drops only the posts, not the sitemap.
  let posts: BlogListItem[] = []
  try {
    posts = await getBlogPosts()
  } catch (err) {
    console.error("[SITEMAP] could not read the blog posts", err)
  }
  const stamp = (post: BlogListItem) => new Date(post.updatedAt ?? post.publishedAt ?? 0)
  const blogPages: MetadataRoute.Sitemap =
    posts.length === 0
      ? []
      : [
          {
            url: url("/blog"),
            lastModified: new Date(Math.max(...posts.map((p) => stamp(p).getTime()))),
            changeFrequency: "weekly",
            priority: 0.6,
          },
          ...posts.map((post) => ({
            url: url(`/blog/${post.slug}`),
            lastModified: stamp(post),
            changeFrequency: "monthly" as const,
            priority: 0.5,
          })),
        ]

  const staticPages: MetadataRoute.Sitemap = [
    { url: url("/"), lastModified: on(UPDATED.home), changeFrequency: "weekly", priority: 1 },
    {
      url: url("/about"),
      lastModified: on(UPDATED.about),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: url("/contact"),
      lastModified: on(UPDATED.contact),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: url("/riders"),
      lastModified: on(UPDATED.riders),
      changeFrequency: "weekly",
      priority: 0.5,
    },
    { url: url("/faq"), lastModified: on(UPDATED.faq), changeFrequency: "monthly", priority: 0.5 },
    {
      url: url("/track"),
      lastModified: on(UPDATED.track),
      changeFrequency: "yearly",
      priority: 0.4,
    },
  ]

  const productPages: MetadataRoute.Sitemap = [
    {
      url: url("/products"),
      lastModified: on(UPDATED.products),
      changeFrequency: "weekly",
      priority: 0.95,
    },
    ...PRODUCTS.map((p) => ({
      url: url(`/product/${p.slug}`),
      lastModified: on(UPDATED.product),
      changeFrequency: "weekly" as const,
      priority: 0.95,
    })),
  ]

  const policyPages: MetadataRoute.Sitemap = POLICIES.map((p) => ({
    url: url(`/policies/${p.slug}`),
    lastModified: on(p.updated),
    changeFrequency: "yearly",
    priority: 0.3,
  }))

  return [...staticPages, ...productPages, ...policyPages, ...blogPages]
}
