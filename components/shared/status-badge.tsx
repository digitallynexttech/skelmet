import { ORDER_STATUS_COLORS, ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/constants"
import { cn } from "@/lib/utils"

const TONE = {
  neutral: "border-white/[0.16] text-ash",
  accent: "border-ember/35 text-ember",
  success: "border-acid/30 text-acid",
  danger: "border-magenta/40 text-magenta",
} as const

/**
 * Tone keys map to tokens here - never an ad-hoc colour at the call site (§7).
 * `label` replaces the status's own words where they would mislead: "Paid" on
 * an order that has only had its advance paid.
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
    <span
      className={cn(
        "inline-flex items-center rounded border px-2.5 py-1 font-mono text-[10px] tracking-[0.12em] uppercase",
        TONE[ORDER_STATUS_COLORS[status]],
        className,
      )}
    >
      {label ?? ORDER_STATUS_LABELS[status]}
    </span>
  )
}
