import { createImageUrlBuilder } from "@sanity/image-url"

import type { SanityImage } from "@/features/blog/blog"
import { dataset, projectId, sanityConfigured } from "@/features/blog/sanity/env"

/**
 * Addresses of a post's pictures on Sanity's image CDN. Client-safe: the post
 * cards render in the browser and need only this arithmetic, not the Sanity
 * client.
 *
 * The pictures are served by that CDN at the width each screen asks for
 * (components/sanity-image.tsx), not through this server's image optimiser:
 * they are already on a CDN that resizes, and the box here has two cores.
 */

type Builder = ReturnType<typeof createImageUrlBuilder>
type Source = Parameters<Builder["image"]>[0]

// Made on first use, and only with a project to point at, so an unconfigured
// blog gets no pictures instead of a throw at import time.
let builder: Builder | null = null

function getBuilder(): Builder | null {
  if (!sanityConfigured) return null
  builder ??= createImageUrlBuilder({ projectId, dataset })
  return builder
}

/**
 * The URL of an image at `width`, cropped to `height` around its hotspot when
 * one is given. Null when there is no image, or no Sanity project.
 *
 * With both, the URL carries `w` and `h`: SanityImage's loader reads the two
 * to keep the shape while it asks for other widths.
 */
export function imageUrl(
  source: SanityImage | null | undefined,
  size: { width: number; height?: number },
): string | null {
  const b = getBuilder()
  if (!b || !source?.asset?._ref) return null
  const image = b
    .image(source as Source)
    .auto("format")
    .width(size.width)
  return size.height ? image.height(size.height).fit("crop").url() : image.fit("max").url()
}

/**
 * The pixel size of the original, which its reference carries
 * (`image-<id>-<width>x<height>-<format>`). An image in the body is given
 * these as its width and height, so the text below it does not jump when the
 * picture arrives.
 */
export function imageDimensions(
  source: SanityImage | null | undefined,
): { width: number; height: number } | null {
  const match = /-(\d+)x(\d+)-[a-z0-9]+$/i.exec(source?.asset?._ref ?? "")
  const width = match ? Number(match[1]) : 0
  const height = match ? Number(match[2]) : 0
  return width > 0 && height > 0 ? { width, height } : null
}

/**
 * next/image's loader for these URLs: the same picture at the width a screen
 * asks for. When the URL carries both `w` and `h` it is a crop, and the
 * height follows the width so every size keeps the same shape.
 */
export function sanityLoader({
  src,
  width,
  quality,
}: {
  src: string
  width: number
  quality?: number
}): string {
  const url = new URL(src)
  const w = Number(url.searchParams.get("w"))
  const h = Number(url.searchParams.get("h"))
  if (w > 0 && h > 0) url.searchParams.set("h", String(Math.round((h / w) * width)))
  url.searchParams.set("w", String(width))
  url.searchParams.set("q", String(quality ?? 75))
  return url.href
}
