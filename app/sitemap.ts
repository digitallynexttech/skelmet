import type { MetadataRoute } from "next"

import { siteConfig } from "@/config/site"
import { PRODUCTS } from "@/features/catalog/catalog"
import { POLICIES } from "@/features/policies/policies"

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  const url = (path: string) => `${siteConfig.url}${path}`

  const staticPages: MetadataRoute.Sitemap = [
    { url: url("/"), lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: url("/about"), lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: url("/contact"), lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: url("/riders"), lastModified: now, changeFrequency: "weekly", priority: 0.5 },
    { url: url("/faq"), lastModified: now, changeFrequency: "monthly", priority: 0.5 },
  ]

  const productPages: MetadataRoute.Sitemap = PRODUCTS.map((p) => ({
    url: url(`/product/${p.slug}`),
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.95,
  }))

  const policyPages: MetadataRoute.Sitemap = POLICIES.map((p) => ({
    url: url(`/policies/${p.slug}`),
    lastModified: now,
    changeFrequency: "yearly",
    priority: 0.3,
  }))

  return [...staticPages, ...productPages, ...policyPages]
}
