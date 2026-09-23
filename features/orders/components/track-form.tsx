"use client"

import * as React from "react"
import { AlertTriangle, ArrowRight, PackageSearch, Truck } from "lucide-react"

import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Field, Input } from "@/components/ui/input"
import type { TrackedOrder } from "@/features/orders/server/track.service"
import { apiFetch } from "@/lib/api-fetch"
import { ApiFetchError } from "@/lib/api-fetch"
import type { OrderStatus } from "@/lib/constants"

/**
 * The lookup this page has always displayed but never performed — the form was
 * markup with no handler, so "Track it" reloaded the page and nothing else.
 */
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
        err instanceof ApiFetchError ? err.message : "That didn't work. Try again in a moment.",
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="max-w-[520px]">
      <form onSubmit={handleSubmit} className="rounded-card bg-carbon border border-white/10 p-6 sm:p-8">
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
              className="font-mono tracking-[0.06em]"
            />
          </Field>
          <Field label="Email on the order">
            <Input name="email" type="email" required placeholder="you@example.com" />
          </Field>
          <Button type="submit" variant="primary" size="md" full disabled={pending} className="mt-1">
            {pending ? "Looking…" : "Track it"}
            <ArrowRight className="size-4" strokeWidth={2.4} />
          </Button>
        </div>
      </form>

      {error ? (
        <div className="border-magenta/35 bg-magenta/[0.06] mt-5 flex items-start gap-2.5 rounded-xl border p-4">
          <AlertTriangle className="text-magenta mt-0.5 size-4 shrink-0" strokeWidth={1.9} />
          <p className="text-bone text-[13.5px] leading-[1.5]">{error}</p>
        </div>
      ) : null}

      {order ? (
        <div className="rounded-card bg-carbon mt-5 border border-white/10 p-6 sm:p-8">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <span className="font-display text-bone text-[22px] tracking-[0.06em]">
              {order.number}
            </span>
            <StatusBadge status={order.status as OrderStatus} />
          </div>

          <ul className="mb-5 flex flex-col gap-1.5">
            {order.items.map((item) => (
              <li key={item.name} className="text-ash text-[14px] leading-[1.5]">
                {item.qty} × {item.name}
              </li>
            ))}
          </ul>

          {order.courier ? (
            <div className="flex items-start gap-2.5 border-t border-white/[0.08] pt-5">
              <Truck className="text-ember mt-0.5 size-4 shrink-0" strokeWidth={1.9} />
              <p className="text-ash text-[13.5px] leading-[1.5]">
                <span className="text-bone">{order.courier}</span>
                {order.awb ? (
                  <>
                    {" · "}
                    <span className="font-mono tracking-[0.04em]">{order.awb}</span>
                  </>
                ) : null}
              </p>
            </div>
          ) : (
            <p className="text-dim border-t border-white/[0.08] pt-5 text-[13.5px] leading-[1.5]">
              No courier assigned yet. We dispatch within 48 hours of the order.
            </p>
          )}
        </div>
      ) : null}
    </div>
  )
}
