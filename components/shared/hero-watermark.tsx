import { cn } from "@/lib/utils"

/* Stroke opacity is per-hue, not shared: against #0e0d13 violet is the darkest
   of the set and needs the most to register, acid the brightest and the least.
   All are pitched to sit *under* hero copy without competing with it. */
const STROKES = {
  blaze: "[-webkit-text-stroke:1px_rgb(255_90_31_/_0.20)]",
  ember: "[-webkit-text-stroke:1px_rgb(255_138_0_/_0.18)]",
  violet: "[-webkit-text-stroke:1px_rgb(123_92_255_/_0.28)]",
  acid: "[-webkit-text-stroke:1px_rgb(212_255_61_/_0.16)]",
  magenta: "[-webkit-text-stroke:1px_rgb(255_61_154_/_0.20)]",
} as const

export type WatermarkAccent = keyof typeof STROKES

/**
 * The outline word sitting behind a hero's copy.
 *
 * One shared size for every page that uses it — 19vw echoes the SKELMET mark in
 * the footer — so the heroes read as one system. Sits against the right of the
 * section, padded to the same gutter as the copy rather than hung off the edge
 * with a negative offset, so the last letter never clips against overflow-hidden.
 *
 * Pass an array to break a long mark over two lines. That keeps the type size
 * identical to every other page and buys the width back vertically instead —
 * the alternative, shrinking it to fit, would break the shared size.
 */
export function HeroWatermark({
  children,
  accent = "blaze",
}: {
  children: string | string[]
  accent?: WatermarkAccent
}) {
  const lines = Array.isArray(children) ? children : [children]

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 flex items-center justify-end overflow-hidden pr-5 select-none sm:pr-8 xl:pr-14"
    >
      <div
        className={cn(
          "font-display text-right text-[clamp(90px,19vw,300px)] leading-[0.85] text-transparent uppercase",
          STROKES[accent],
        )}
      >
        {lines.map((line) => (
          <div key={line} className="whitespace-nowrap">
            {line}
          </div>
        ))}
      </div>
    </div>
  )
}
