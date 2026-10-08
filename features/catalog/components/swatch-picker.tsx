"use client"

import type { Colourway, ColourwayId } from "@/features/catalog/catalog"
import { cn } from "@/lib/utils"

/** A card's colours as dots, the picked one ringed and named. Above a card-wide link (z-20). */
export function SwatchPicker({
  colourways,
  picked,
  onPick,
  named = true,
  className,
}: {
  colourways: Colourway[]
  picked: ColourwayId
  onPick: (id: ColourwayId) => void
  /** The picked colour's name beside the dots. */
  named?: boolean
  className?: string
}) {
  const name = colourways.find((c) => c.id === picked)?.name
  return (
    <div className={cn("relative z-20 flex items-center gap-3.5", className)}>
      <div role="group" aria-label="Colour" className="flex items-center gap-3">
        {colourways.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={c.id === picked}
            aria-label={c.name}
            title={c.name}
            onClick={() => onPick(c.id)}
            className={cn(
              "ring-offset-carbon relative size-[18px] shrink-0 rounded-full ring-offset-2 transition-shadow",
              // A 32px target round the 18px dot.
              "before:absolute before:-inset-[7px] before:content-['']",
              c.id === picked ? "ring-bone/80 ring-2" : "hover:ring-1 hover:ring-white/40",
            )}
            style={{ backgroundColor: c.hex }}
          />
        ))}
      </div>
      {named ? (
        <span className="text-ash font-mono text-[11.5px] tracking-[0.22em] uppercase">{name}</span>
      ) : null}
    </div>
  )
}
