"use client"

import Image, { type ImageProps } from "next/image"

import { sanityLoader } from "@/features/blog/lib/image"

/** next/image for Sanity's CDN. Client-side only because a loader cannot cross from the server. */
export function SanityImage({ alt, ...props }: Omit<ImageProps, "loader">) {
  return <Image {...props} alt={alt} loader={sanityLoader} />
}
