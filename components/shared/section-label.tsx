import { cn } from "@/lib/utils"

const TONES = {
  ember: "text-ember",
  acid: "text-acid",
  violet: "text-violet",
  magenta: "text-magenta",
} as const

/**
 * The mono eyebrow on every section: `01 / THE LINEUP`.
 *
 * The number is NOT passed in. It used to be, and every component carried a
 * default left over from the homepage running order — so the product page
 * showed 03, 04, 05, 07, 06, 10, 09, 13: gapped AND out of order, because a
 * component cannot know where a page chose to put it.
 *
 * A CSS counter scoped to <main> numbers them in document order instead.
 * These are async server components, so React context is not available to
 * carry a counter, and a module-level one would leak between concurrent
 * requests. The counter recomputes from the DOM, so commenting a section out
 * renumbers the rest with no other edit.
 *
 * Opt in with `numbered`: hero eyebrows ("Track order", "Contact") are
 * labels, not numbered sections, and must stay out of the sequence.
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
