"use client"

import Image, { type ImageProps } from "next/image"

import { sanityLoader } from "@/features/blog/lib/image"

/**
 * next/image for a picture that lives on Sanity's CDN.
 *
 * A client component only because a loader is a function, and a function
 * cannot be handed from a server component to next/image. It renders the same
 * <img> on the server as anywhere else.
 */
export function SanityImage({ alt, ...props }: Omit<ImageProps, "loader">) {
  return <Image {...props} alt={alt} loader={sanityLoader} />
}
