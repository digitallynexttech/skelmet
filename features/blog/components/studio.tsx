"use client"

import { NextStudio } from "next-sanity/studio"

import config from "@/features/blog/sanity/config"

// Client-only, so none of the Studio is evaluated at build time.
export function Studio() {
  return <NextStudio config={config} />
}
