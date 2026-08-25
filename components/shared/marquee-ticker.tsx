import { cn } from "@/lib/utils"

/**
 * Duplicated track translated -50%, so the seam is invisible because both halves
 * are identical. Pauses on hover; frozen entirely under reduced-motion.
 */
export function MarqueeTicker({
  items,
  className,
  tone = "blaze",
}: {
  items: string[]
  className?: string
  tone?: "blaze" | "acid"
}) {
  const track = (
    <div
      className="flex w-1/2 shrink-0 items-center gap-8 font-mono text-[13px] font-bold tracking-[0.18em] whitespace-nowrap"
      aria-hidden="true"
    >
      {items.map((item, i) => (
        <span key={`${item}-${i}`} className="flex items-center gap-8">
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
      <div className="flex h-full w-[200%] animate-marquee items-center group-hover:[animation-play-state:paused]">
        {track}
        {track}
      </div>
    </div>
  )
}
