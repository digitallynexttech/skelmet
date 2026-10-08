import { cn } from "@/lib/utils"

// Stroke opacity is tuned per hue (violet is darkest, acid brightest) to sit under hero copy.
const STROKES = {
  blaze: "[-webkit-text-stroke:1px_rgb(255_90_31_/_0.20)]",
  ember: "[-webkit-text-stroke:1px_rgb(255_138_0_/_0.18)]",
  violet: "[-webkit-text-stroke:1px_rgb(123_92_255_/_0.28)]",
  acid: "[-webkit-text-stroke:1px_rgb(212_255_61_/_0.16)]",
  magenta: "[-webkit-text-stroke:1px_rgb(255_61_154_/_0.20)]",
} as const

/** The same hues as channels, for the glow (globals.css: .hero-mark-*). */
const GLOW = {
  blaze: "255 90 31",
  ember: "255 138 0",
  violet: "123 92 255",
  acid: "212 255 61",
  magenta: "255 61 154",
} as const

export type WatermarkAccent = keyof typeof STROKES

/**
 * The outline word behind a hero's copy, one shared size on every page. Pass an array to break a
 * long word over two lines rather than shrink it. Padded to the gutter, never offset past the
 * edge, so it does not clip. Only opacity and transforms animate, so nothing repaints.
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
      className="pointer-events-none absolute inset-0 overflow-hidden select-none"
      style={{ "--glow": GLOW[accent] } as React.CSSProperties}
    >
      <Word lines={lines} className={STROKES[accent]} />
      {/* xl up only: narrower, the word runs behind the copy and a glow there competes. */}
      <div className="max-xl:hidden">
        <Word lines={lines} className="hero-mark-glow" />
        <div className="hero-mark-sweep">
          <div className="hero-mark-sweep-track">
            <Word lines={lines} className="hero-mark-shine" />
          </div>
        </div>
      </div>
    </div>
  )
}

// Every copy uses the same box, so outline, glow and shine line up.
function Word({ lines, className }: { lines: string[]; className: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-end pr-5 sm:pr-8 xl:pr-14">
      <div
        className={cn(
          "font-display text-right text-[clamp(90px,19vw,300px)] leading-[0.85] text-transparent uppercase",
          className,
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
