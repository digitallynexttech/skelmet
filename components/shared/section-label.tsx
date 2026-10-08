import { cn } from "@/lib/utils"

const TONES = {
  ember: "text-ember",
  acid: "text-acid",
  violet: "text-violet",
  magenta: "text-magenta",
} as const

/**
 * The mono eyebrow on a section: `01 / THE LINEUP`. The number comes from a CSS counter on
 * <main> in document order, never a prop: a component cannot know where a page puts it. Hero
 * eyebrows leave `numbered` off to stay out of the sequence.
 */
export function SectionLabel({
  numbered,
  children,
  tone = "ember",
  className,
}: {
  numbered?: boolean
  children: React.ReactNode
  tone?: keyof typeof TONES
  className?: string
}) {
  return (
    <div
      data-section-no={numbered ? "" : undefined}
      className={cn("font-mono text-[11.5px] tracking-[0.22em] uppercase", TONES[tone], className)}
    >
      {children}
    </div>
  )
}
