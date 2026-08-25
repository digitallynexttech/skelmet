import { cn } from "@/lib/utils"

const TONES = {
  ember: "text-ember",
  acid: "text-acid",
  violet: "text-violet",
  magenta: "text-magenta",
} as const

/** The mono eyebrow that numbers every section: `01 / THE LINEUP`. */
export function SectionLabel({
  index,
  children,
  tone = "ember",
  className,
}: {
  index?: string
  children: React.ReactNode
  tone?: keyof typeof TONES
  className?: string
}) {
  return (
    <div
      className={cn(
        "font-mono text-[11.5px] tracking-[0.22em] uppercase",
        TONES[tone],
        className,
      )}
    >
      {index ? `${index} / ` : null}
      {children}
    </div>
  )
}
