import type { MetadataRoute } from "next"

import { siteConfig } from "@/config/site"
import { PRODUCTS } from "@/features/catalog/catalog"
import { POLICIES } from "@/features/policies/policies"

/**
 * When each page's content last changed, bumped by hand when it does.
 *
 * `new Date()` used to stamp every URL with the moment of the request, telling
 * crawlers that every page changed every time they asked - which teaches them
 * to ignore the field altogether. Policies carry their own date, the one
 * printed at the top of the page.
 */
const UPDATED = {
  home: "2026-09-28",
  about: "2026-09-28",
  contact: "2026-09-28",
  riders: "2026-09-28",
  faq: "2026-09-28",
  track: "2026-09-28",
  product: "2026-09-28",
}

export default function sitemap(): MetadataRoute.Sitemap {
  const url = (path: string) => `${siteConfig.url}${path}`
  const on = (iso: string) => new Date(`${iso}T00:00:00Z`)

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

  const productPages: MetadataRoute.Sitemap = PRODUCTS.map((p) => ({
    url: url(`/product/${p.slug}`),
    lastModified: on(UPDATED.product),
    changeFrequency: "weekly",
    priority: 0.95,
  }))

  const policyPages: MetadataRoute.Sitemap = POLICIES.map((p) => ({
    url: url(`/policies/${p.slug}`),
    lastModified: on(p.updated),
    changeFrequency: "yearly",
    priority: 0.3,
  }))

  return [...staticPages, ...productPages, ...policyPages]
}
