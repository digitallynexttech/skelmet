import { cn } from "@/lib/utils"

/** Renders a 0–5 rating as filled/hollow stars. Rounds to the nearest half up. */
export function Stars({ rating, className }: { rating: number; className?: string }) {
  const filled = Math.round(rating)
  return (
    <span
      className={cn("tracking-[0.1em] text-ember", className)}
      aria-label={`${rating} out of 5`}
    >
      {"★".repeat(Math.min(5, filled))}
      {"☆".repeat(Math.max(0, 5 - filled))}
    </span>
  )
}
