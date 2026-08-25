import Link from "next/link"

import { SkullMark } from "@/components/shared/skull-mark"
import { cn } from "@/lib/utils"

export function Wordmark({ className, size = "md" }: { className?: string; size?: "sm" | "md" }) {
  return (
    <Link href="/" className={cn("flex items-center gap-3", className)}>
      <SkullMark className={size === "sm" ? "size-5" : "size-[26px]"} />
      <span
        className={cn(
          "font-display tracking-[0.14em] text-bone",
          size === "sm" ? "text-[19px]" : "text-[23px]",
        )}
      >
        SKELMET
      </span>
    </Link>
  )
}
