import { cn } from "@/lib/utils"

/**
 * One tile of a console board: a label over a big figure. Given `onClick`
 * it is also a filter, pressed while that filter is on.
 */
export function BoardTile({
  label,
  value,
  tone = "text-bone",
  active = false,
  empty = false,
  onClick,
}: {
  label: string
  value: React.ReactNode
  /** Text colour for the figure, from the same tones the badges use. */
  tone?: string
  active?: boolean
  /**
   * Nothing in it. The tile stays on the board but steps back, so the eye
   * lands on the queues that actually need working.
   */
  empty?: boolean
  onClick?: () => void
}) {
  const className = cn(
    "rounded-md border px-4 py-3.5 text-left transition-colors",
    active ? "border-blaze/60 bg-blaze/[0.07]" : "bg-carbon border-white/[0.09]",
    onClick && !active && "hover:border-white/25",
    empty && !active && "opacity-45",
  )
  const body = (
    <>
      {/* Two lines' worth of room whether or not the label needs it, so a
          label that wraps does not push its figure below its neighbours'. */}
      <div className="text-dim mb-2 flex min-h-[2.4em] items-start font-mono text-[9.5px] leading-[1.2] tracking-[0.14em] uppercase">
        {label}
      </div>
      <div className={cn("font-display text-[26px] leading-none", empty ? "text-dim" : tone)}>
        {value}
      </div>
    </>
  )

  return onClick ? (
    <button type="button" onClick={onClick} aria-pressed={active} className={className}>
      {body}
    </button>
  ) : (
    <div className={className}>{body}</div>
  )
}
