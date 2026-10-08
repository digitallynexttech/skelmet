"use client"

import { Check } from "lucide-react"

import type { PaymentMethod } from "@/features/checkout/payment-options"
import type { OrderStatus } from "@/lib/constants"
import { cn } from "@/lib/utils"

// Forward flow only: the caller renders cancelled, returned and refunded orders,
// since a rail would promise a parcel that is not coming.
const FLOW = ["PAID", "PACKED", "SHIPPED", "DELIVERED"] as const

const LABELS: Record<(typeof FLOW)[number], string> = {
  PAID: "Payment confirmed",
  PACKED: "Packed",
  SHIPPED: "Handed to courier",
  DELIVERED: "Delivered",
}

/** COD and PARTIAL must never read "Payment confirmed". */
const FIRST_STEP: Record<PaymentMethod, string> = {
  ONLINE: LABELS.PAID,
  PARTIAL: "Advance paid",
  COD: "Order confirmed",
}

export type TimelineDates = {
  placedAt: string | null
  shippedAt: string | null
  deliveredAt: string | null
}

/** "23 Sep". */
function formatDay(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })
}

export function OrderTimeline({
  status,
  dates,
  paymentMethod = "ONLINE",
}: {
  status: OrderStatus
  dates: TimelineDates
  paymentMethod?: PaymentMethod
}) {
  // PENDING is before the rail (-1); CONFIRMED is COD's first step.
  const reached = status === "CONFIRMED" ? 0 : (FLOW as readonly string[]).indexOf(status)

  // PACKED has no timestamp on the order.
  const at: Record<(typeof FLOW)[number], string | null> = {
    PAID: dates.placedAt,
    PACKED: null,
    SHIPPED: dates.shippedAt,
    DELIVERED: dates.deliveredAt,
  }

  return (
    <ol className="flex flex-col">
      {FLOW.map((step, i) => {
        const done = reached >= i
        const current = reached === i
        const day = formatDay(at[step])

        return (
          <li key={step} className="relative flex gap-3.5 pb-[18px] last:pb-0">
            {i < FLOW.length - 1 ? (
              <span
                aria-hidden
                className={cn(
                  "absolute top-[24px] bottom-0 left-[11px] w-px",
                  reached > i ? "bg-ember/45" : "bg-white/[0.09]",
                )}
              />
            ) : null}

            <span
              aria-hidden
              className={cn(
                "relative z-10 grid size-[23px] shrink-0 place-items-center rounded-full border transition-colors",
                done
                  ? "border-ember/70 bg-ember/15 text-ember"
                  : "bg-carbon border-white/[0.14] text-white/20",
                current && "ring-ember/20 ring-4",
              )}
            >
              {done ? (
                <Check className="size-[11px]" strokeWidth={3.2} />
              ) : (
                <span className="size-[5px] rounded-full bg-current" />
              )}
            </span>

            <div className="flex min-w-0 flex-1 items-baseline justify-between gap-3 pt-0.5">
              <span
                className={cn(
                  "text-[13.5px] leading-[1.4]",
                  current ? "text-bone font-medium" : done ? "text-ash" : "text-dim",
                )}
              >
                {step === "PAID" ? FIRST_STEP[paymentMethod] : LABELS[step]}
              </span>
              <span className="text-dim shrink-0 font-mono text-[11px] tracking-[0.04em]">
                {day ?? "-"}
              </span>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
