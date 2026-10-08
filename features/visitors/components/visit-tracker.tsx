"use client"

import * as React from "react"
import { usePathname, useSearchParams } from "next/navigation"

import { startEngagement, trackPage, watchCart } from "@/features/visitors/lib/tracker"

/** Mounted once in the storefront layout, so it sees every navigation. */
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
