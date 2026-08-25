"use client"

import * as React from "react"
import Link from "next/link"
import {
  ArrowLeft,
  Ban,
  CreditCard,
  MapPin,
  PackageCheck,
  Home,
  RotateCcw,
  Truck,
} from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { Money } from "@/components/shared/money"
import { StatusBadge } from "@/components/shared/status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field, Input } from "@/components/ui/input"
import { useOrder, useOrderAction } from "@/features/orders/hooks/use-orders"
import type { OrderStatus } from "@/lib/constants"

const TIMELINE: Array<{ status: OrderStatus; label: string; Icon: typeof Truck }> = [
  { status: "PAID", label: "Paid", Icon: CreditCard },
  { status: "PACKED", label: "Packed", Icon: PackageCheck },
  { status: "SHIPPED", label: "Shipped", Icon: Truck },
  { status: "DELIVERED", label: "Delivered", Icon: Home },
]

const ORDER_OF = (s: OrderStatus) => TIMELINE.findIndex((t) => t.status === s)

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-[14px]">
      <span className="text-ash">{label}</span>
      <span className="text-right font-mono text-bone">{value}</span>
    </div>
  )
}

function ShipDialog({ onShip, pending }: { onShip: (v: { courier: string; awb: string }) => void; pending: boolean }) {
  const [courier, setCourier] = React.useState("")
  const [awb, setAwb] = React.useState("")

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (courier.trim() && awb.trim()) onShip({ courier: courier.trim(), awb: awb.trim() })
      }}
      className="rounded-tile border border-white/[0.09] bg-void p-5"
    >
      <div className="mb-4 font-mono text-[10px] tracking-[0.16em] text-dim uppercase">
        Mark shipped
      </div>
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <Field label="Courier">
          <Input value={courier} onChange={(e) => setCourier(e.target.value)} placeholder="Delhivery" required />
        </Field>
        <Field label="AWB / tracking">
          <Input
            value={awb}
            onChange={(e) => setAwb(e.target.value)}
            placeholder="1234567890"
            className="font-mono"
            required
          />
        </Field>
      </div>
      <Button type="submit" variant="primary" size="sm" disabled={pending}>
        <Truck className="size-4" strokeWidth={1.9} />
        Confirm shipped
      </Button>
    </form>
  )
}

export function OrderDetailView({ id }: { id: string }) {
  const { data: order, isLoading, isError, error } = useOrder(id)
  const actions = useOrderAction(id)

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="h-14 w-64 animate-pulse rounded-xl bg-white/5" />
        <div className="h-96 animate-pulse rounded-card bg-white/5" />
      </div>
    )
  }

  if (isError || !order) {
    return (
      <EmptyState
        title="Order not found"
        description={error instanceof Error ? error.message : "It may have been removed."}
        action={
          <Link href="/admin/orders" className="text-[13.5px] font-semibold text-ember">
            Back to orders
          </Link>
        }
      />
    )
  }

  const addr = order.shippingAddress as Record<string, string>
  const stage = ORDER_OF(order.status)
  const dead = order.status === "CANCELLED" || order.status === "REFUNDED"
  const busy = Object.values(actions).some((a) => a.isPending)

  return (
    <div className="flex flex-col gap-7">
      <div>
        <Link
          href="/admin/orders"
          className="mb-5 inline-flex items-center gap-2 text-[13.5px] text-ash transition-colors hover:text-bone"
        >
          <ArrowLeft className="size-4" strokeWidth={2} />
          All orders
        </Link>

        <div className="flex flex-wrap items-center gap-4">
          <h1 className="font-display text-[34px] leading-[1.04] text-bone sm:text-[42px]">
            {order.number}
          </h1>
          <StatusBadge status={order.status} />
          <Badge variant={order.paymentMethod === "COD" ? "violet" : "muted"}>
            {order.paymentMethod === "COD" ? "Cash on delivery" : "Paid online"}
          </Badge>
          {order.coupon ? <Badge variant="acid">{order.coupon.code}</Badge> : null}
        </div>
        <p className="mt-2 font-mono text-[12px] text-dim">
          Placed {new Date(order.placedAt ?? order.createdAt).toLocaleString("en-IN")}
        </p>
      </div>

      {/* Fulfilment timeline */}
      {!dead ? (
        <div className="rounded-card border border-white/[0.09] bg-carbon p-6">
          <ol className="grid gap-5 sm:grid-cols-4">
            {TIMELINE.map((step, i) => {
              const done = stage >= i && stage !== -1
              return (
                <li key={step.status} className="flex items-center gap-3">
                  <span
                    className={
                      done
                        ? "flex size-9 shrink-0 items-center justify-center rounded-full bg-blaze"
                        : "flex size-9 shrink-0 items-center justify-center rounded-full border-2 border-white/[0.14]"
                    }
                  >
                    <step.Icon
                      className={done ? "size-4 text-void" : "size-4 text-dim"}
                      strokeWidth={2}
                    />
                  </span>
                  <span className={done ? "text-[14px] text-bone" : "text-[14px] text-dim"}>
                    {step.label}
                  </span>
                </li>
              )
            })}
          </ol>
        </div>
      ) : null}

      {/* Actions */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2.5">
          {order.status === "PAID" || (order.status === "PENDING" && order.paymentMethod === "COD") ? (
            <Button variant="primary" size="sm" disabled={busy} onClick={() => actions.pack.mutate()}>
              <PackageCheck className="size-4" strokeWidth={1.9} />
              Mark packed
            </Button>
          ) : null}
          {order.status === "SHIPPED" ? (
            <Button
              variant="primary"
              size="sm"
              disabled={busy}
              onClick={() => actions.deliver.mutate()}
            >
              <Home className="size-4" strokeWidth={1.9} />
              Mark delivered
            </Button>
          ) : null}
          {["PENDING", "PAID"].includes(order.status) ? (
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => actions.cancel.mutate()}>
              <Ban className="size-4" strokeWidth={1.9} />
              Cancel &amp; restock
            </Button>
          ) : null}
          {["PAID", "PACKED", "SHIPPED", "DELIVERED", "RETURNED"].includes(order.status) ? (
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => actions.refund.mutate()}>
              <RotateCcw className="size-4" strokeWidth={1.9} />
              Refund
            </Button>
          ) : null}
        </div>

        {order.status === "PACKED" ? (
          <ShipDialog onShip={(v) => actions.ship.mutate(v)} pending={actions.ship.isPending} />
        ) : null}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Items */}
        <div className="rounded-card border border-white/[0.09] bg-carbon">
          <div className="border-b border-white/[0.07] px-6 py-4 font-mono text-[10px] tracking-[0.16em] text-dim uppercase">
            Items
          </div>
          <ul className="divide-y divide-white/[0.06]">
            {order.items.map((item) => (
              <li key={item.id} className="flex items-center gap-4 px-6 py-4">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blaze/12 font-mono text-[13px] font-bold text-blaze">
                  {item.qty}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] text-bone">{item.nameSnapshot}</span>
                  <span className="block font-mono text-[11px] text-dim">{item.variant.sku}</span>
                </span>
                <Money value={Number(item.unitPrice) * item.qty} className="font-mono text-[14px] text-bone" />
              </li>
            ))}
          </ul>

          <div className="flex flex-col gap-3 border-t border-white/[0.07] px-6 py-5">
            <Row label="Subtotal" value={<Money value={order.subtotal} />} />
            {Number(order.discount) > 0 ? (
              <Row
                label="Discount"
                value={<span className="text-acid">− <Money value={order.discount} /></span>}
              />
            ) : null}
            <Row
              label="Shipping"
              value={Number(order.shipping) === 0 ? <span className="text-acid">FREE</span> : <Money value={order.shipping} />}
            />
            <div className="mt-2 flex items-baseline justify-between border-t border-white/[0.07] pt-4">
              <span className="text-[15px] font-semibold text-bone">Total</span>
              <Money value={order.total} className="font-display text-[28px] text-bone" />
            </div>
          </div>
        </div>

        {/* Customer + payment + shipment */}
        <div className="flex flex-col gap-5">
          <section className="rounded-card border border-white/[0.09] bg-carbon p-6">
            <div className="mb-4 flex items-center gap-2.5">
              <MapPin className="size-4 text-ember" strokeWidth={1.9} />
              <h2 className="font-mono text-[10px] tracking-[0.16em] text-dim uppercase">
                Ship to
              </h2>
            </div>
            <address className="text-[14px] leading-[1.7] text-bone not-italic">
              {addr.firstName} {addr.lastName}
              <br />
              {addr.line1}
              {addr.line2 ? (
                <>
                  <br />
                  {addr.line2}
                </>
              ) : null}
              <br />
              {addr.city}, {addr.state}
              <br />
              <span className="font-mono">{addr.pincode}</span>
            </address>
            <div className="mt-4 flex flex-col gap-1.5 border-t border-white/[0.07] pt-4 font-mono text-[12.5px] text-ash">
              <a href={`mailto:${order.email}`} className="truncate hover:text-bone">
                {order.email}
              </a>
              <a href={`tel:${order.phone}`} className="hover:text-bone">
                {order.phone}
              </a>
            </div>
            {order.shippingAddress.giftNote ? (
              <Badge variant="magenta" className="mt-4">
                Gift, no invoice in box
              </Badge>
            ) : null}
          </section>

          <section className="rounded-card border border-white/[0.09] bg-carbon p-6">
            <div className="mb-4 flex items-center gap-2.5">
              <CreditCard className="size-4 text-violet" strokeWidth={1.9} />
              <h2 className="font-mono text-[10px] tracking-[0.16em] text-dim uppercase">Payment</h2>
            </div>
            {order.payments.length === 0 ? (
              <p className="text-[13.5px] text-ash">
                Cash on delivery. Collect{" "}
                <Money value={order.total} className="font-mono text-bone" /> at the door.
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {order.payments.map((p) => (
                  <li key={p.gatewayOrderId} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[13.5px] text-bone capitalize">{p.gateway}</span>
                      <Badge variant={p.status === "CAPTURED" ? "acid" : "muted"}>{p.status}</Badge>
                    </div>
                    <span className="font-mono text-[11px] break-all text-dim">
                      {p.gatewayPaymentId ?? p.gatewayOrderId}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {order.shipment ? (
            <section className="rounded-card border border-white/[0.09] bg-carbon p-6">
              <div className="mb-4 flex items-center gap-2.5">
                <Truck className="size-4 text-acid" strokeWidth={1.9} />
                <h2 className="font-mono text-[10px] tracking-[0.16em] text-dim uppercase">
                  Shipment
                </h2>
              </div>
              <div className="flex flex-col gap-2 text-[13.5px]">
                <Row label="Courier" value={order.shipment.courier} />
                <Row label="AWB" value={order.shipment.awb ?? "-"} />
                <Row label="Status" value={order.shipment.status} />
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  )
}
