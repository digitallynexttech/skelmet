"use client"

import * as React from "react"
import { AlertTriangle, ArrowRight, Check, Copy, PackageSearch, Truck } from "lucide-react"

import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Field, Input } from "@/components/ui/input"
import { OrderTimeline } from "@/features/orders/components/order-timeline"
import type { TrackedOrder } from "@/features/orders/server/track.service"
import { apiFetch, ApiFetchError } from "@/lib/api-fetch"
import { formatDay, formatEta } from "@/lib/delivery"
import type { OrderStatus } from "@/lib/constants"
import { cn } from "@/lib/utils"

/**
 * The lookup this page has always displayed but never performed - the form was
 * markup with no handler, so "Track it" reloaded the page and nothing else.
 *
 * Form and result sit side by side once there is room for both: the result is
 * the thing people came for, and stacking it under a form pushed it below the
 * fold on the very screens with space to spare.
 */

/** Orders that have left the delivery path. A progress rail would mislead. */
const OFF_PATH = new Set<OrderStatus>(["CANCELLED", "RETURNED", "REFUNDED"])

const OFF_PATH_NOTE: Partial<Record<OrderStatus, string>> = {
  CANCELLED:
    "This order was cancelled. Nothing is on its way, and anything paid goes back to the original method.",
  RETURNED:
    "This order came back to us. Once it has been checked in, the refund follows to the original method.",
  REFUNDED: "This order has been refunded. Banks usually take 5-7 working days to show it.",
}

export function TrackForm() {
  const [order, setOrder] = React.useState<TrackedOrder | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [pending, setPending] = React.useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setOrder(null)
    setPending(true)

    const form = new FormData(event.currentTarget)
    try {
      const found = await apiFetch<TrackedOrder>("/api/public/track", {
        method: "POST",
        body: JSON.stringify({
          orderNumber: String(form.get("orderNumber") ?? ""),
          email: String(form.get("email") ?? ""),
        }),
      })
      setOrder(found)
    } catch (err) {
      // The service answers 404 the same way for a bad number and a bad email,
      // so its message is already the right thing to show.
      setError(
        err instanceof ApiFetchError ? err.message : "That did not work. Try again in a moment.",
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] lg:items-start lg:gap-8">
      <form
        onSubmit={handleSubmit}
        className="rounded-card bg-carbon border border-white/10 p-6 sm:p-7"
      >
        <div className="mb-5 flex items-center gap-3">
          <PackageSearch className="text-ember size-5" strokeWidth={1.8} />
          <span className="text-dim font-mono text-[10.5px] tracking-[0.18em] uppercase">
            Order lookup
          </span>
        </div>
        <div className="flex flex-col gap-4">
          <Field label="Order number">
            <Input
              name="orderNumber"
              required
              placeholder="SKM-2026-0412"
              autoComplete="off"
              spellCheck={false}
              className="font-mono tracking-[0.06em] uppercase"
            />
          </Field>
          <Field label="Email on the order">
            <Input name="email" type="email" required placeholder="you@example.com" />
          </Field>
          <Button type="submit" variant="primary" size="md" full disabled={pending} className="mt-1">
            {pending ? "Looking…" : "Track it"}
            <ArrowRight className="size-4" strokeWidth={2.4} />
          </Button>
          <p className="text-dim mt-1 text-[12px] leading-[1.5]">
            Both are on your confirmation email.
          </p>
        </div>
      </form>

      <div className="min-w-0">
        {error ? (
          <div className="border-magenta/35 bg-magenta/[0.06] flex items-start gap-2.5 rounded-xl border p-4">
            <AlertTriangle className="text-magenta mt-0.5 size-4 shrink-0" strokeWidth={1.9} />
            <p className="text-bone text-[13.5px] leading-[1.5]">{error}</p>
          </div>
        ) : order ? (
          <OrderResult order={order} />
        ) : (
          // Desktop only: on a phone the form already fills the screen, and an
          // empty box under it is just one more thing to scroll past.
          <div className="rounded-card hidden place-items-center border border-dashed border-white/[0.09] p-10 lg:grid">
            <p className="text-dim text-center text-[13.5px] leading-[1.6]">
              Your order and where it has got to
              <br />
              will appear here.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function OrderResult({ order }: { order: TrackedOrder }) {
  const [copied, setCopied] = React.useState(false)
  const status = order.status as OrderStatus
  const placed = formatDay(order.placedAt)

  const arrival = OFF_PATH.has(order.status as OrderStatus)
    ? null
    : order.deliveredAt
      ? { label: "Delivered on", value: formatDay(order.deliveredAt) ?? "-", done: true }
      : order.placedAt
        ? { label: "Arriving by", value: formatEta(order.placedAt), done: false }
        : null

  async function copyAwb() {
    if (!order.awb) return
    try {
      await navigator.clipboard.writeText(order.awb)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      // Clipboard is blocked in some in-app browsers. The number is on screen
      // to read either way, so there is nothing useful to say here.
    }
  }

  return (
    <div className="rounded-card bg-carbon border border-white/10 p-6 sm:p-7">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <span className="font-display text-bone text-[24px] tracking-[0.06em]">{order.number}</span>
        <StatusBadge status={status} />
      </div>
      {placed ? (
        <p className="text-dim mb-5 text-[12.5px]">
          Placed {placed} · {order.itemCount} {order.itemCount === 1 ? "item" : "items"}
        </p>
      ) : null}

      {/* The date is the question. Delivered orders show the day it actually
          landed; anything still moving shows the far end of the published
          window, because quoting the optimistic end turns a normal delivery
          into a late one. Cancelled and returned orders get neither - there
          is nothing coming. */}
      {arrival ? (
        <div
          className={cn(
            "rounded-tile mb-6 flex items-center justify-between gap-3 border px-4 py-3.5",
            arrival.done
              ? "border-acid/30 bg-acid/[0.06]"
              : "border-ember/30 bg-ember/[0.06]",
          )}
        >
          <span className="text-dim font-mono text-[10px] tracking-[0.18em] uppercase">
            {arrival.label}
          </span>
          <span
            className={cn(
              "font-mono text-[14px] font-bold tracking-[0.06em]",
              arrival.done ? "text-acid" : "text-ember",
            )}
          >
            {arrival.value}
          </span>
        </div>
      ) : null}

      <ul className="mb-6 flex flex-col gap-1.5">
        {order.items.map((item) => (
          <li key={item.name} className="text-ash text-[14px] leading-[1.5]">
            <span className="text-dim font-mono text-[12.5px]">{item.qty}×</span> {item.name}
          </li>
        ))}
      </ul>

      {OFF_PATH.has(status) ? (
        <p className="text-ash border-t border-white/[0.08] pt-5 text-[13.5px] leading-[1.6]">
          {OFF_PATH_NOTE[status]}
        </p>
      ) : (
        <div className="border-t border-white/[0.08] pt-5">
          <OrderTimeline
            status={status}
            dates={{
              placedAt: order.placedAt,
              shippedAt: order.shippedAt,
              deliveredAt: order.deliveredAt,
            }}
          />
        </div>
      )}

      {order.courier ? (
        <div className="mt-5 flex items-start gap-2.5 border-t border-white/[0.08] pt-5">
          <Truck className="text-ember mt-0.5 size-4 shrink-0" strokeWidth={1.9} />
          <div className="min-w-0 flex-1">
            <p className="text-bone text-[13.5px] leading-[1.5]">{order.courier}</p>
            {order.awb ? (
              <button
                type="button"
                onClick={copyAwb}
                className="text-ash hover:text-bone mt-1 inline-flex items-center gap-1.5 font-mono text-[12.5px] tracking-[0.04em] transition-colors"
                aria-label={`Copy tracking number ${order.awb}`}
              >
                {order.awb}
                {copied ? (
                  <Check className="text-ember size-3.5" strokeWidth={2.6} />
                ) : (
                  <Copy className="size-3.5 opacity-55" strokeWidth={2} />
                )}
              </button>
            ) : null}
          </div>
        </div>
      ) : !OFF_PATH.has(status) ? (
        <p className="text-dim mt-5 border-t border-white/[0.08] pt-5 text-[13px] leading-[1.5]">
          No courier assigned yet. We dispatch within 48 hours of the order.
        </p>
      ) : null}
    </div>
  )
}
