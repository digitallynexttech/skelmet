import { ORDER_STATUS_COLORS, ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/constants"
import { cn } from "@/lib/utils"

const TONE = {
  neutral: "border-white/[0.16] text-ash",
  accent: "border-ember/35 text-ember",
  success: "border-acid/30 text-acid",
  danger: "border-magenta/40 text-magenta",
} as const

export type Tone = keyof typeof TONE

/** For statuses that are not an order's own. */
export function ToneBadge({
  tone,
  title,
  className,
  children,
}: {
  tone: Tone
  /** Hover text explaining the status. */
  title?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center rounded border px-2.5 py-1 font-mono text-[10px] tracking-[0.12em] uppercase",
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

/**
 * Colours come from the tone tokens, never ad hoc at the call site. `label` overrides the status's
 * words where they would mislead (e.g. "Paid" when only the advance is).
 */
export function StatusBadge({
  status,
  label,
  className,
}: {
  status: OrderStatus
  label?: string
  className?: string
}) {
  return (
    <ToneBadge tone={ORDER_STATUS_COLORS[status]} className={className}>
      {label ?? ORDER_STATUS_LABELS[status]}
    </ToneBadge>
  )
}
