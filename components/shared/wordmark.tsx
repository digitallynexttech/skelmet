import Image from "next/image"
import Link from "next/link"

import { siteConfig } from "@/config/site"
import { cn } from "@/lib/utils"

/**
 * The brand lockup, reversed for a dark ground.
 *
 * `/public/brand/skelmet-lockup.png` is derived from the supplied artwork with
 * the dark ink repainted as bone; the orange is untouched. The delivered files
 * are drawn for white paper, so the wordmark would otherwise sit at roughly
 * 1.1:1 against `--color-void` and disappear.
 *
 * Sized by height, never width: the skull rises above the caps and its jaw
 * drops below them, so height is what lines the lockup up with everything else
 * on the row.
 */
export const BRAND_LOCKUP = {
  src: "/brand/skelmet-lockup.png",
  width: 896,
  height: 312,
} as const

export function Wordmark({ className, size = "md" }: { className?: string; size?: "sm" | "md" }) {
  return (
    <Link href="/" className={cn("inline-flex items-center", className)}>
      <Image
        src={BRAND_LOCKUP.src}
        width={BRAND_LOCKUP.width}
        height={BRAND_LOCKUP.height}
        alt={siteConfig.name}
        // h-10 against a 2.87:1 lockup is ~115px wide; h-8 is narrower still.
        sizes="120px"
        // Above the fold on every page, and the splash paints the same file, so
        // it wants to be in flight with the document rather than after it.
        priority
        className={cn("w-auto", size === "sm" ? "h-8" : "h-10")}
      />
    </Link>
  )
}
