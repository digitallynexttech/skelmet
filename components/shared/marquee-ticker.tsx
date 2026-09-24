import { cn } from "@/lib/utils"

/**
 * Two identical tracks translated -50%, so the seam lands on a glyph-for-glyph
 * match and is invisible. Pauses on hover; frozen entirely under reduced-motion.
 *
 * Each track hugs its content rather than being pinned to the viewport width:
 * pinning it meant that whenever the items measured narrower than the screen -
 * which they do on any desktop - the rest of the track was empty, and the strip
 * read as one pass followed by a gap rather than as a continuous repeat. The
 * items are instead repeated inside the track until it is wider than any
 * plausible viewport, so there is always more text arriving.
 *
 * Because the travel is now a content width rather than a viewport width, the
 * speed is the same on every screen. It used to be tied to the viewport, which
 * made the strip crawl at ~14px/s on a phone and run at ~74px/s on a desktop.
 */

/**
 * Passes of the item list per track. The track has to out-measure the widest
 * viewport it will ever run in, or the strip empties out before it wraps -
 * which is the failure this replaced. At the current copy one pass is ~1430px,
 * so 3 covers ~4285px: an unscaled 4K and any ultrawide. Raise it if the item
 * list gets shorter, and retune --animate-marquee with it to hold the speed.
 */
const REPEATS = 3

export function MarqueeTicker({
  items,
  className,
  tone = "blaze",
}: {
  items: string[]
  className?: string
  tone?: "blaze" | "acid"
}) {
  const sequence = Array.from({ length: REPEATS }, () => items).flat()

  // Spacing lives on the units, not on their parents: a unit carries its own
  // trailing gap, so the rhythm holds across the seam between the two tracks
  // without a gap on the runner - which would otherwise be counted into the
  // -50% and shift the seam off the match.
  const track = (
    <div
      className="flex w-max shrink-0 items-center font-mono text-[13px] font-bold tracking-[0.18em] whitespace-nowrap"
      aria-hidden="true"
    >
      {sequence.map((item, i) => (
        <span key={`${item}-${i}`} className="flex items-center gap-8 pr-8">
          {item}
          <span aria-hidden>✦</span>
        </span>
      ))}
    </div>
  )

  return (
    <div
      className={cn(
        "group relative h-15 overflow-hidden border-y border-black/30",
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
