import { cn } from "@/lib/utils"

// Two identical content-width tracks translated -50%, so the seam is invisible and the speed is
// the same on every screen. Pauses on hover; frozen under reduced motion.

// Each track must be wider than any viewport (one pass is ~1430px). Raise this if the items get
// shorter, and retune --animate-marquee with it to hold the speed.
const REPEATS = 3

export function MarqueeTicker({
  items,
  className,
  tone = "blaze",
  slim = false,
}: {
  items: string[]
  className?: string
  tone?: "blaze" | "acid"
  /** The announcement bar's size. */
  slim?: boolean
}) {
  const sequence = Array.from({ length: REPEATS }, () => items).flat()

  // Each unit carries its own trailing gap; a gap on the runner would skew the -50% seam.
  const track = (
    <div
      className={cn(
        "flex w-max shrink-0 items-center font-mono font-bold whitespace-nowrap",
        slim ? "text-[11px] tracking-[0.16em]" : "text-[13px] tracking-[0.18em]",
      )}
      aria-hidden="true"
    >
      {sequence.map((item, i) => (
        <span
          key={`${item}-${i}`}
          className={cn("flex items-center", slim ? "gap-6 pr-6" : "gap-8 pr-8")}
        >
          {item}
          <span aria-hidden>✦</span>
        </span>
      ))}
    </div>
  )

  return (
    <div
      className={cn(
        "group relative overflow-hidden",
        slim ? "h-9" : "h-15 border-y border-black/30",
        tone === "blaze" ? "bg-blaze text-void" : "bg-acid text-void",
        className,
      )}
    >
      <span className="sr-only">{items.join(". ")}</span>
      <div className="animate-marquee flex h-full w-max items-center group-hover:[animation-play-state:paused]">
        {track}
        {track}
      </div>
    </div>
  )
}
