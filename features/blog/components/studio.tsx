"use client"

import { NextStudio } from "next-sanity/studio"

import config from "@/features/blog/sanity/config"

/**
 * The Sanity Studio, which is an application of its own that runs entirely in
 * the browser. Behind "use client" so none of it is evaluated when the site
 * is built.
 */
export function Studio() {
  return <NextStudio config={config} />
}
