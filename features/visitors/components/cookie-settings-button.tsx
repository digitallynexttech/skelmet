"use client"

import { useConsent } from "@/features/visitors/hooks/use-consent"
import { cn } from "@/lib/utils"

/** Reopens the cookie bar, as the privacy policy promises. */
export function CookieSettingsButton({ className }: { className?: string }) {
  const review = useConsent((s) => s.review)
  return (
    <button
      type="button"
      onClick={review}
      className={cn("hover:text-bone uppercase transition-colors", className)}
    >
      Cookie settings
    </button>
  )
}
