import Image from "next/image"
import Link from "next/link"

import { siteConfig } from "@/lib/config/site"
import { cn } from "@/lib/utils"

/**
 * The brand lockup with the dark ink repainted as bone for a dark ground. Size it by height,
 * never width: the skull overshoots the caps, so height is what lines it up with the row.
 */
export const BRAND_LOCKUP = {
  src: "/brand/skelmet-lockup.png",
  width: 896,
  height: 312,
} as const

/** As outlines, for drawing wider than the PNG's 896px. Built by scripts/build-brand-assets.mjs. */
export const BRAND_LOCKUP_VECTOR = {
  src: "/brand/skelmet-lockup.svg",
  width: 896,
  height: 312,
} as const

export function Wordmark({
  className,
  size = "md",
  lazy = false,
}: {
  className?: string
  size?: "sm" | "md"
  /**
   * For a copy that starts hidden (the phone menu), so it is fetched only when shown. Served
   * unoptimised: the optimiser's copy is a hair off the ratio and audits flag it as stretched.
   */
  lazy?: boolean
}) {
  return (
    <Link href="/" className={cn("inline-flex items-center", className)}>
      <Image
        src={BRAND_LOCKUP.src}
        width={BRAND_LOCKUP.width}
        height={BRAND_LOCKUP.height}
        alt={siteConfig.name}
        // h-10 at 2.87:1 is ~115px wide.
        sizes="120px"
        // Eager, but low priority so it never queues ahead of the hero or product photo.
        loading={lazy ? "lazy" : "eager"}
        unoptimized={lazy}
        fetchPriority="low"
        className={cn("w-auto", size === "sm" ? "h-8" : "h-10")}
      />
    </Link>
  )
}
