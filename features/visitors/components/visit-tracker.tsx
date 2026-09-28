"use client"

import * as React from "react"
import { usePathname, useSearchParams } from "next/navigation"

import { startEngagement, trackPage, watchCart } from "@/features/visitors/lib/tracker"

/**
 * Mounted once, in the storefront layout, so it survives navigation between
 * pages and sees every one of them. Renders nothing.
 *
 * It runs for every visitor. What the server keeps depends on the cookie
 * choice, which the tracker sends with each message - see tracker.ts.
 */
export function VisitTracker() {
  const pathname = usePathname()
  const search = useSearchParams().toString()

  React.useEffect(() => startEngagement(), [])
  React.useEffect(() => watchCart(), [])
  React.useEffect(() => {
    trackPage(search ? `${pathname}?${search}` : pathname)
  }, [pathname, search])

  return null
}
