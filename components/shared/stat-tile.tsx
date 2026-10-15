import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

export function StatTile({
  label,
  hint,
  icon: Icon,
  tone,
  active = false,
  onClick,
  children,
}: {
  label: string
  /** What the figure includes, under it. */
  hint?: React.ReactNode
  icon?: LucideIcon
  /** Text colour class for the icon. */
  tone?: string
  /** A filter's tile: pressed while its filter is on. */
  active?: boolean
  onClick?: () => void
  children: React.ReactNode
}) {
  const className = cn(
    // A column from the top: a button would centre a short tile's figure beside a taller one's.
    "flex flex-col rounded-md border px-5 py-4 text-left",
    active ? "border-blaze/60 bg-blaze/[0.07]" : "bg-carbon border-white/[0.09]",
    onClick && !active && "transition-colors hover:border-white/25",
  )
  const body = (
    <>
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <span className="text-ash text-[13px] font-semibold">{label}</span>
        {Icon ? <Icon className={cn("size-4 shrink-0", tone)} strokeWidth={1.9} /> : null}
      </div>
      <div className="text-bone text-[22px] leading-none font-semibold">{children}</div>
      {hint ? <div className="text-dim mt-2 text-[12px]">{hint}</div> : null}
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
