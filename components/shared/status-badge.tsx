import { ORDER_STATUS_COLORS, ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/constants"
import { cn } from "@/lib/utils"

const TONE = {
  neutral: "border-white/[0.16] text-ash",
  accent: "border-ember/35 text-ember",
  success: "border-acid/30 text-acid",
  danger: "border-magenta/40 text-magenta",
} as const

/** Tone keys map to tokens here — never an ad-hoc colour at the call site (§7). */
export function StatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-2.5 py-1 font-mono text-[10px] tracking-[0.12em] uppercase",
        TONE[ORDER_STATUS_COLORS[status]],
        className,
      )}
    >
      {ORDER_STATUS_LABELS[status]}
    </span>
  )
}
