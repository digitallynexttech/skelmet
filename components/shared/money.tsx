import { formatMoney } from "@/lib/money"
import { cn } from "@/lib/utils"

/** Single place prices render, so the format never drifts between pages. */
export function Money({
  value,
  className,
  strike = false,
}: {
  value: string | number
  className?: string
  strike?: boolean
}) {
  return (
    <span className={cn(strike && "text-dim line-through", className)}>{formatMoney(value)}</span>
  )
}
