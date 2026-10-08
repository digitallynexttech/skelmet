"use client"

import * as React from "react"
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Copy,
  ExternalLink,
  PackageSearch,
  Truck,
} from "lucide-react"

import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Field, Input } from "@/components/ui/input"
import { statusLabelFor } from "@/features/checkout/payment-options"
import { OrderTimeline } from "@/features/orders/components/order-timeline"
import type { TrackedOrder } from "@/features/orders/server/track.service"
import { siteConfig } from "@/lib/config/site"
import { apiFetch, ApiFetchError } from "@/lib/api-fetch"
import { formatDay, formatEta } from "@/lib/delivery"
import type { OrderStatus } from "@/lib/constants"
import { formatMoney } from "@/lib/money"
import { cn } from "@/lib/utils"

const P = siteConfig.promise

/** Off the delivery path: a progress rail would mislead. */
const OFF_PATH = new Set<OrderStatus>(["CANCELLED", "RETURNED", "REFUNDED"])

/** Refund timing must match the returns policy word for word. */
const OFF_PATH_NOTE: Partial<Record<OrderStatus, string>> = {
  CANCELLED: `This order was cancelled, so nothing is on its way. If you paid for it, the refund goes to the original payment method within ${P.refundDays}, and banks usually take ${P.bankDays} more to show it.`,
  RETURNED: `This order came back to us. Once it passes inspection, the refund goes to the original payment method within ${P.refundDays}, and banks usually take ${P.bankDays} more to show it.`,
  REFUNDED: `This order has been refunded to the original payment method. Banks usually take ${P.bankDays} to show it.`,
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
      // The service gives one 404 message for a bad number or email.
      setError(
        err instanceof ApiFetchError ? err.message : "That did not work. Try again in a moment.",
      )
    } finally {
      setPending(false)
    }
  }

  return (
    // Privacy: masked from Clarity recordings.
    <div
      data-clarity-mask="true"
      className="grid gap-6 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] lg:items-start lg:gap-8"
    >
      <form
        onSubmit={handleSubmit}
        className="rounded-card bg-carbon border border-white/10 p-6 sm:p-7"
      >
        <div className="mb-5 flex items-center gap-3">
          <PackageSearch className="text-ember size-5" strokeWidth={1.8} />
          <span className="text-dim font-mono text-[11px] tracking-[0.14em] uppercase">
            Order lookup
          </span>
        </div>
        <div className="flex flex-col gap-4">
          <Field label="Order number">
            <Input
              name="orderNumber"
              required
              // Order numbers never use 0, 1, I or O.
              placeholder="SKM-2026-4F2K"
              autoComplete="off"
              spellCheck={false}
              className="font-mono tracking-[0.06em] uppercase"
            />
          </Field>
          <Field label="Email on the order">
            <Input name="email" type="email" required placeholder="you@example.com" />
          </Field>
          <Button
            type="submit"
            variant="primary"
            size="md"
            full
            disabled={pending}
            className="mt-1"
          >
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
          // Desktop only: on a phone it is just more to scroll past.
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
  const due =
    Number(order.dueOnDelivery) > 0 && !order.deliveredAt && !OFF_PATH.has(status)
      ? order.dueOnDelivery
      : null

  // The courier's estimate once given; until then the far end of the promised window,
  // so a normal delivery never reads as late.
  const arrival = OFF_PATH.has(order.status as OrderStatus)
    ? null
    : order.deliveredAt
      ? { label: "Delivered on", value: formatDay(order.deliveredAt) ?? "-", done: true }
      : order.etd
        ? {
            label: "Arriving by",
            value: new Date(order.etd)
              .toLocaleDateString("en-IN", {
                weekday: "short",
                day: "numeric",
                month: "short",
                timeZone: "Asia/Kolkata",
              })
              .toUpperCase(),
            done: false,
          }
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
      // Blocked in some in-app browsers; the number is on screen anyway.
    }
  }

  return (
    <div className="rounded-card bg-carbon border border-white/10 p-6 sm:p-7">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <span className="font-display text-bone text-[24px] tracking-[0.06em]">{order.number}</span>
        <StatusBadge status={status} label={statusLabelFor(status, order.paymentMethod)} />
      </div>
      {placed ? (
        <p className="text-dim mb-5 text-[12.5px]">
          Placed {placed} · {order.itemCount} {order.itemCount === 1 ? "item" : "items"}
        </p>
      ) : null}

      {arrival ? (
        <div
          className={cn(
            "rounded-tile mb-6 flex items-center justify-between gap-3 border px-4 py-3.5",
            arrival.done ? "border-acid/30 bg-acid/[0.06]" : "border-ember/30 bg-ember/[0.06]",
          )}
        >
          <span className="text-dim font-mono text-[11px] tracking-[0.14em] uppercase">
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

      {due ? (
        <div className="rounded-tile mb-6 flex items-center justify-between gap-3 border border-white/[0.12] px-4 py-3.5">
          <span className="text-dim font-mono text-[11px] tracking-[0.14em] uppercase">
            To pay the courier
          </span>
          <span className="text-bone font-mono text-[14px] font-bold tracking-[0.06em]">
            {formatMoney(due)}
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
            paymentMethod={order.paymentMethod}
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
            <p className="text-bone text-[13.5px] leading-[1.5]">
              {order.courier}
              {order.courierStatus && !order.deliveredAt ? (
                <span className="text-ash">
                  {" "}
                  · {order.courierStatus.charAt(0)}
                  {order.courierStatus.slice(1).toLowerCase()}
                </span>
              ) : null}
            </p>
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
            {order.trackingUrl ? (
              <a
                href={order.trackingUrl}
                target="_blank"
                rel="noreferrer"
                className="text-ember hover:text-bone mt-1.5 flex w-fit items-center gap-1.5 text-[12.5px] transition-colors"
              >
                Live tracking with the courier
                <ExternalLink className="size-3.5" strokeWidth={2} />
              </a>
            ) : null}
          </div>
        </div>
      ) : !OFF_PATH.has(status) ? (
        <p className="text-dim mt-5 border-t border-white/[0.08] pt-5 text-[13px] leading-[1.5]">
          No courier assigned yet. We dispatch within {P.dispatchHours} hours of{" "}
          {order.paymentMethod === "COD" ? "your order" : "payment"}.
        </p>
      ) : null}
    </div>
  )
}
