import { cn } from "@/lib/utils"

/** The SKELMET glyph. Stroke follows currentColor unless overridden. */
export function SkullMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn("size-6 text-blaze", className)}
    >
      <path d="M12 2C7.6 2 4.5 5.2 4.5 9.6c0 2.4.9 4 2.1 5.2.5.5.8 1.1.8 1.8V19a1 1 0 0 0 1 1h1.2v-2h1.6v2h1.6v-2h1.6v2H16a1 1 0 0 0 1-1v-2.4c0-.7.3-1.3.8-1.8 1.2-1.2 2.1-2.8 2.1-5.2C19.9 5.2 16.4 2 12 2Z" />
      <circle cx="9.1" cy="10.4" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="14.9" cy="10.4" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  )
}
