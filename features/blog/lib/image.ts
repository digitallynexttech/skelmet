import { createImageUrlBuilder } from "@sanity/image-url"

import type { SanityImage } from "@/features/blog/blog"
import { dataset, projectId, sanityConfigured } from "@/features/blog/sanity/env"

// Client-safe URLs on Sanity's image CDN, which resizes, so this server's two-core optimiser is
// skipped.

type Builder = ReturnType<typeof createImageUrlBuilder>
type Source = Parameters<Builder["image"]>[0]

// Made on first use, so an unconfigured blog gets no pictures instead of an import-time throw.
let builder: Builder | null = null

function getBuilder(): Builder | null {
  if (!sanityConfigured) return null
  builder ??= createImageUrlBuilder({ projectId, dataset })
  return builder
}

/**
 * An image at `width`, cropped to `height` around its hotspot when given (sanityLoader keeps that
 * shape at other widths). Null with no image or no Sanity project.
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

/** The original's pixel size, from its reference (`image-<id>-<width>x<height>-<format>`). */
export function imageDimensions(
  source: SanityImage | null | undefined,
): { width: number; height: number } | null {
  const match = /-(\d+)x(\d+)-[a-z0-9]+$/i.exec(source?.asset?._ref ?? "")
  const width = match ? Number(match[1]) : 0
  const height = match ? Number(match[2]) : 0
  return width > 0 && height > 0 ? { width, height } : null
}

/** next/image loader. With both `w` and `h` it is a crop, so `h` scales with the width. */
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
