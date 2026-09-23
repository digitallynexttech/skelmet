"use client"

import { Check } from "lucide-react"

import type { OrderStatus } from "@/lib/constants"
import { cn } from "@/lib/utils"

/**
 * The happy path as a rail, because "where is it?" is a question about
 * PROGRESS and a single status badge does not answer it. A buyer looking at
 * "Paid" cannot tell whether that is one step from done or four.
 *
 * Only the forward flow is drawn. Cancelled, returned and refunded orders
 * leave it — a rail implies motion toward delivery, and drawing one under a
 * refund would promise a parcel that is not coming. The caller renders those.
 */
const FLOW = ["PAID", "PACKED", "SHIPPED", "DELIVERED"] as const

const LABELS: Record<(typeof FLOW)[number], string> = {
  PAID: "Payment confirmed",
  PACKED: "Packed",
  SHIPPED: "Handed to courier",
  DELIVERED: "Delivered",
}

export type TimelineDates = {
  placedAt: string | null
  shippedAt: string | null
  deliveredAt: string | null
}

/** Short and unambiguous: "23 Sep". The year is almost never the question. */
function formatDay(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })
}

export function OrderTimeline({ status, dates }: { status: OrderStatus; dates: TimelineDates }) {
  // PENDING sits before the rail entirely — nothing has happened yet.
  const reached = (FLOW as readonly string[]).indexOf(status)

  // Only PACKED has no timestamp of its own on the order, so it borrows the
  // step's position rather than inventing a date.
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
                  : "border-white/[0.14] bg-carbon text-white/20",
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
                {LABELS[step]}
              </span>
              <span className="text-dim shrink-0 font-mono text-[11px] tracking-[0.04em]">
                {day ?? "—"}
              </span>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
