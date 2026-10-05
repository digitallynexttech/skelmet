import type { Metadata } from "next"

import { siteConfig } from "@/config/site"

type ShareImage = { url: string; width?: number; height?: number; alt?: string }

/**
 * Title, description, canonical and share cards for one storefront page.
 *
 * Next merges metadata shallowly: a page that sets `openGraph` or `twitter`
 * replaces the root layout's whole object - image, site name and locale
 * included - not just the fields it names. So a page never spells out a
 * partial card here; it gets the full set, and a link shared from it shows
 * that page's own title and description rather than the home page's.
 */
export function pageMetadata({
  title,
  description,
  path,
  image = siteConfig.shareImage,
}: {
  /** Bare page title. The root layout's template adds " - SKELMET" to the tab. */
  title: string
  description: string
  /** Path from the site root, e.g. `/about`. metadataBase makes it absolute. */
  path: string
  image?: ShareImage
}): Metadata {
  const shareTitle = `${title} - ${siteConfig.name}`
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      locale: "en_IN",
      siteName: siteConfig.name,
      url: path,
      title: shareTitle,
      description,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: shareTitle,
      description,
      images: [image.url],
    },
  }
}
