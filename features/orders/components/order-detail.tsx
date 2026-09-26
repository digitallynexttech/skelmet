"use client"

import * as React from "react"
import Link from "next/link"
import { useQueryClient } from "@tanstack/react-query"
import {
  ArrowLeft,
  Ban,
  CreditCard,
  ExternalLink,
  FileText,
  Mail,
  MapPin,
  Printer,
  PackageCheck,
  Home,
  RefreshCw,
  RotateCcw,
  Truck,
} from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { Money } from "@/components/shared/money"
import { StatusBadge } from "@/components/shared/status-badge"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Field, Input } from "@/components/ui/input"
import {
  useCourierOptions,
  useOrder,
  useOrderAction,
  type OrderDetail,
} from "@/features/orders/hooks/use-orders"
import { useConfirm, type Ask } from "@/hooks/use-confirm"
import type { OrderStatus } from "@/lib/constants"
import { formatMoney } from "@/lib/money"
import { cn } from "@/lib/utils"

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
      <span className="text-bone text-right font-mono">{value}</span>
    </div>
  )
}

/** "IN TRANSIT" -> "In transit". The courier's words, readable. */
function readable(status: string): string {
  const s = status.replace(/_/g, " ").trim().toLowerCase()
  return s ? s[0]!.toUpperCase() + s.slice(1) : "-"
}

function when(iso: string | null, withTime = true): string {
  if (!iso) return "-"
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : { year: "numeric" }),
  })
}

/**
 * Booking through Shiprocket, for a packed order.
 *
 * Rates are only fetched when asked for - each is a lookup on the shop's
 * account - and Shiprocket's recommendation is preselected, which is also what
 * "Book Shiprocket's pick" takes without looking. A booking that got its AWB
 * but not its pickup comes back here as "Finish booking", which carries on
 * from where it stopped rather than asking for a second courier.
 */
function BookCourier({
  order,
  actions,
  busy,
  ask,
}: {
  order: OrderDetail
  actions: ReturnType<typeof useOrderAction>
  busy: boolean
  ask: Ask
}) {
  const [asked, setAsked] = React.useState(false)
  const [manual, setManual] = React.useState(false)
  const [chosen, setChosen] = React.useState<number | null>(null)
  const couriers = useCourierOptions(order.id, asked)

  const kept =
    order.shipment?.provider === "shiprocket" && order.shipment.awb ? order.shipment : null
  const options = couriers.data?.options ?? []
  const selected = chosen ?? couriers.data?.recommendedId ?? options[0]?.id ?? null
  const pick = options.find((o) => o.id === selected)

  if (manual) {
    return (
      <ShipDialog
        ask={ask}
        onShip={(v, done) => actions.ship.mutate(v, { onSettled: done })}
        pending={actions.ship.isPending}
      >
        <button
          type="button"
          onClick={() => setManual(false)}
          className="text-ash hover:text-bone text-[12.5px] underline-offset-4 hover:underline"
        >
          Book through Shiprocket instead
        </button>
      </ShipDialog>
    )
  }

  return (
    <div className="bg-void rounded-md border border-white/[0.09] p-5">
      <div className="text-dim mb-4 font-mono text-[10px] tracking-[0.16em] uppercase">
        Book courier · Shiprocket
      </div>

      {kept ? (
        <div className="flex flex-col gap-3">
          <p className="text-ash text-[13.5px] leading-[1.55]">
            <span className="text-bone">{kept.courier}</span> is booked with AWB{" "}
            <span className="text-bone font-mono">{kept.awb}</span>, but the pickup is not scheduled
            yet. Finishing carries on from there - it keeps this AWB.
          </p>
          <div>
            <Button
              variant="primary"
              size="sm"
              disabled={busy}
              onClick={() =>
                ask({
                  title: "Finish booking?",
                  body: (
                    <>
                      Schedules the pickup for {kept.courier}, AWB{" "}
                      <span className="text-bone font-mono">{kept.awb}</span>. The AWB is kept, so
                      the wallet is not charged again. The customer is emailed that the order has
                      shipped.
                    </>
                  ),
                  confirmLabel: "Finish booking",
                  run: (done) => actions.book.mutate({}, { onSettled: done }),
                })
              }
            >
              <Truck className="size-4" strokeWidth={1.9} />
              Finish booking
            </Button>
          </div>
        </div>
      ) : !asked ? (
        <div className="flex flex-wrap gap-2.5">
          <Button variant="primary" size="sm" disabled={busy} onClick={() => setAsked(true)}>
            <Truck className="size-4" strokeWidth={1.9} />
            Show couriers &amp; rates
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() =>
              ask({
                title: "Book Shiprocket's pick?",
                body: "Shiprocket chooses the courier from your account's courier settings and charges your wallet for it, without showing the price here first. It assigns a tracking number and schedules the pickup, and the customer is emailed that the order has shipped. To see the prices first, use Show couriers & rates.",
                confirmLabel: "Book courier",
                run: (done) => actions.book.mutate({}, { onSettled: done }),
              })
            }
          >
            Book Shiprocket&apos;s pick
          </Button>
        </div>
      ) : couriers.isLoading ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-md bg-white/5" />
          ))}
        </div>
      ) : couriers.isError ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-magenta text-[13.5px] leading-[1.5]">
            {couriers.error instanceof Error ? couriers.error.message : "Could not load couriers."}
          </p>
          <Button variant="ghost" size="sm" onClick={() => void couriers.refetch()}>
            <RefreshCw className="size-4" strokeWidth={1.9} />
            Try again
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <fieldset className="flex flex-col gap-2">
            <legend className="sr-only">Courier</legend>
            {options.map((o) => (
              <label
                key={o.id}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-md border px-4 py-3 transition-colors",
                  o.id === selected
                    ? "border-blaze/60 bg-blaze/[0.06]"
                    : "border-white/[0.09] hover:border-white/20",
                )}
              >
                <input
                  type="radio"
                  name={`courier-${order.id}`}
                  checked={o.id === selected}
                  onChange={() => setChosen(o.id)}
                  className="accent-blaze"
                />
                <span className="min-w-0 flex-1">
                  <span className="text-bone flex flex-wrap items-center gap-2 text-[14px]">
                    {o.name}
                    {o.recommended ? <Badge variant="acid">Shiprocket&apos;s pick</Badge> : null}
                  </span>
                  <span className="text-dim block font-mono text-[11.5px]">
                    {o.days ? `${o.days} day${o.days === 1 ? "" : "s"}` : "-"}
                    {o.etd ? ` · by ${when(o.etd, false)}` : ""}
                    {o.rating ? ` · rated ${o.rating.toFixed(1)}` : ""}
                  </span>
                </span>
                <Money value={o.rate} className="text-bone font-mono text-[14px]" />
              </label>
            ))}
          </fieldset>
          <div>
            <Button
              variant="primary"
              size="sm"
              disabled={busy || !pick}
              onClick={() =>
                pick &&
                ask({
                  title: `Book ${pick.name}?`,
                  body: (
                    <>
                      Charges <span className="text-bone font-mono">{formatMoney(pick.rate)}</span>{" "}
                      to your Shiprocket wallet, assigns a tracking number and schedules the pickup.
                      The customer is emailed that the order has shipped.
                    </>
                  ),
                  confirmLabel: `Book for ${formatMoney(pick.rate)}`,
                  run: (done) => actions.book.mutate({ courierId: pick.id }, { onSettled: done }),
                })
              }
            >
              <Truck className="size-4" strokeWidth={1.9} />
              {pick ? `Book ${pick.name}` : "Book"}
            </Button>
          </div>
        </div>
      )}

      {!kept ? (
        <button
          type="button"
          onClick={() => setManual(true)}
          className="text-ash hover:text-bone mt-4 block text-[12.5px] underline-offset-4 hover:underline"
        >
          Enter a courier and AWB by hand instead
        </button>
      ) : null}
    </div>
  )
}

function ShipDialog({
  onShip,
  pending,
  ask,
  children,
}: {
  onShip: (v: { courier: string; awb: string }, done: () => void) => void
  pending: boolean
  ask: Ask
  children?: React.ReactNode
}) {
  const [courier, setCourier] = React.useState("")
  const [awb, setAwb] = React.useState("")

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const v = { courier: courier.trim(), awb: awb.trim() }
        if (!v.courier || !v.awb) return
        ask({
          title: "Mark as shipped?",
          body: (
            <>
              With {v.courier}, AWB <span className="text-bone font-mono">{v.awb}</span>. The order
              moves to Shipped and the customer is emailed these tracking details, so check the AWB
              first.
            </>
          ),
          confirmLabel: "Mark shipped",
          run: (done) => onShip(v, done),
        })
      }}
      className="bg-void rounded-md border border-white/[0.09] p-5"
    >
      <div className="text-dim mb-4 font-mono text-[10px] tracking-[0.16em] uppercase">
        Mark shipped
      </div>
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <Field label="Courier">
          <Input
            value={courier}
            onChange={(e) => setCourier(e.target.value)}
            placeholder="Delhivery"
            required
          />
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
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" variant="primary" size="sm" disabled={pending}>
          <Truck className="size-4" strokeWidth={1.9} />
          Confirm shipped
        </Button>
        {children}
      </div>
    </form>
  )
}

/** Paid for, or cash on delivery that has been packed - as the server decides. */
const INVOICEABLE: OrderStatus[] = ["PAID", "PACKED", "SHIPPED", "DELIVERED"]

function InvoiceSection({
  order,
  actions,
  busy,
  ask,
}: {
  order: OrderDetail
  actions: ReturnType<typeof useOrderAction>
  busy: boolean
  ask: Ask
}) {
  const qc = useQueryClient()
  const canIssue = INVOICEABLE.includes(order.status)
  if (!order.invoiceNumber && !canIssue) return null
  const href = `/api/admin/orders/${order.id}/invoice`

  return (
    <section className="bg-carbon rounded-md border border-white/[0.09] p-6">
      <div className="mb-4 flex items-center gap-2.5">
        <FileText className="text-ember size-4" strokeWidth={1.9} />
        <h2 className="text-dim font-mono text-[10px] tracking-[0.16em] uppercase">Invoice</h2>
      </div>
      <div className="flex flex-col gap-2 text-[13.5px]">
        {order.invoiceNumber ? (
          <>
            <Row label="Number" value={<span className="font-mono">{order.invoiceNumber}</span>} />
            <Row label="Dated" value={when(order.invoicedAt, false)} />
          </>
        ) : (
          <p className="text-ash">
            Opening it for the first time gives it the next invoice number and today&apos;s date.
          </p>
        )}
        <Row
          label="Emailed"
          value={
            order.invoiceEmailedAt
              ? when(order.invoiceEmailedAt)
              : order.status === "DELIVERED"
                ? "Not yet"
                : "On delivery"
          }
        />
      </div>
      <div className="mt-4 flex flex-wrap gap-2.5 border-t border-white/[0.07] pt-4">
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className={buttonVariants({ variant: "primary", size: "sm" })}
          // The first open issues the number; show it once it has.
          onClick={() =>
            window.setTimeout(
              () => void qc.invalidateQueries({ queryKey: ["orders", order.id] }),
              2500,
            )
          }
        >
          <Printer className="size-4" strokeWidth={1.9} />
          Print invoice
        </a>
        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() =>
            ask({
              title: order.invoiceEmailedAt ? "Email the invoice again?" : "Email the invoice?",
              body: `The tax invoice for ${order.number} goes to ${order.email} as a PDF.${
                order.invoiceEmailedAt ? " They already had it once." : ""
              }`,
              confirmLabel: "Email invoice",
              run: (done) => actions.emailInvoice.mutate(undefined, { onSettled: done }),
            })
          }
        >
          <Mail className="size-4" strokeWidth={1.9} />
          {order.invoiceEmailedAt ? "Email again" : "Email invoice"}
        </Button>
      </div>
    </section>
  )
}

export function OrderDetailView({ id }: { id: string }) {
  const { data: order, isLoading, isError, error } = useOrder(id)
  const actions = useOrderAction(id)

  // Everything that moves the order along, charges the courier wallet or
  // sends money back asks first: one mistaken click is hard to take back.
  const { ask, dialog } = useConfirm()

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="h-14 w-64 animate-pulse rounded-md bg-white/5" />
        <div className="h-96 animate-pulse rounded-md bg-white/5" />
      </div>
    )
  }

  if (isError || !order) {
    return (
      <EmptyState
        title="Order not found"
        description={error instanceof Error ? error.message : "It may have been removed."}
        action={
          <Link href="/admin/orders" className="text-ember text-[13.5px] font-semibold">
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
  const units = order.items.reduce((n, i) => n + i.qty, 0)
  const unitsText = `${units} item${units === 1 ? "" : "s"}`
  // Refund restocks what never left; the server makes the same call.
  const unshipped = order.status === "PAID" || order.status === "PACKED"

  return (
    <div className="flex flex-col gap-7">
      {dialog}
      <div>
        <Link
          href="/admin/orders"
          className="text-ash hover:text-bone mb-5 inline-flex items-center gap-2 text-[13.5px] transition-colors"
        >
          <ArrowLeft className="size-4" strokeWidth={2} />
          All orders
        </Link>

        <div className="flex flex-wrap items-center gap-4">
          <h1 className="font-display text-bone text-[34px] leading-[1.04] sm:text-[42px]">
            {order.number}
          </h1>
          <StatusBadge status={order.status} />
          <Badge variant={order.paymentMethod === "COD" ? "violet" : "muted"}>
            {order.paymentMethod === "COD" ? "Cash on delivery" : "Paid online"}
          </Badge>
          {order.coupon ? <Badge variant="acid">{order.coupon.code}</Badge> : null}
        </div>
        <p className="text-dim mt-2 font-mono text-[12px]">
          Placed {new Date(order.placedAt ?? order.createdAt).toLocaleString("en-IN")}
        </p>
      </div>

      {/* Fulfilment timeline */}
      {!dead ? (
        <div className="bg-carbon rounded-md border border-white/[0.09] p-6">
          <ol className="grid gap-5 sm:grid-cols-4">
            {TIMELINE.map((step, i) => {
              const done = stage >= i && stage !== -1
              return (
                <li key={step.status} className="flex items-center gap-3">
                  <span
                    className={
                      done
                        ? "bg-blaze flex size-9 shrink-0 items-center justify-center rounded-full"
                        : "flex size-9 shrink-0 items-center justify-center rounded-full border-2 border-white/[0.14]"
                    }
                  >
                    <step.Icon
                      className={done ? "text-void size-4" : "text-dim size-4"}
                      strokeWidth={2}
                    />
                  </span>
                  <span className={done ? "text-bone text-[14px]" : "text-dim text-[14px]"}>
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
          {order.status === "PAID" ||
          (order.status === "PENDING" && order.paymentMethod === "COD") ? (
            <Button
              variant="primary"
              size="sm"
              disabled={busy}
              onClick={() =>
                ask({
                  title: "Mark as packed?",
                  body: `${order.number} moves to Packed and is ready for a courier. Do this once all ${unitsText} are in the box.`,
                  confirmLabel: "Mark packed",
                  run: (done) => actions.pack.mutate(undefined, { onSettled: done }),
                })
              }
            >
              <PackageCheck className="size-4" strokeWidth={1.9} />
              Mark packed
            </Button>
          ) : null}
          {order.status === "SHIPPED" ? (
            <Button
              variant="primary"
              size="sm"
              disabled={busy}
              onClick={() =>
                ask({
                  title: "Mark as delivered?",
                  body: `Only if you know ${order.number} has arrived. A Shiprocket shipment updates itself from the courier's tracking.`,
                  confirmLabel: "Mark delivered",
                  run: (done) => actions.deliver.mutate(undefined, { onSettled: done }),
                })
              }
            >
              <Home className="size-4" strokeWidth={1.9} />
              Mark delivered
            </Button>
          ) : null}
          {/* Unpaid only - a paid order comes back through Refund, which
              returns the money as well as the stock. */}
          {order.status === "PENDING" ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() =>
                ask({
                  title: "Cancel this order?",
                  body: `${order.number} was never paid, so there is nothing to refund. It is cancelled and its ${unitsText} go back into stock. This cannot be undone.`,
                  confirmLabel: "Cancel order",
                  tone: "danger",
                  run: (done) => actions.cancel.mutate(undefined, { onSettled: done }),
                })
              }
            >
              <Ban className="size-4" strokeWidth={1.9} />
              Cancel &amp; restock
            </Button>
          ) : null}
          {["PAID", "PACKED", "SHIPPED", "DELIVERED", "RETURNED"].includes(order.status) ||
          (order.status === "CANCELLED" && order.payments.some((p) => p.status === "CAPTURED")) ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() =>
                ask({
                  title: `Refund ${formatMoney(order.total)}?`,
                  body: [
                    order.payments.some((p) => p.status === "CAPTURED")
                      ? `The full ${formatMoney(order.total)} goes back to the customer's original payment method through Razorpay.`
                      : "No captured payment is on file, so no money moves through Razorpay. The order is only marked refunded.",
                    unshipped ? `Its ${unitsText} go back into stock.` : "Stock is not changed.",
                    unshipped && order.shiprocket.orderId
                      ? "The order is cancelled in Shiprocket too."
                      : "",
                    "This cannot be undone.",
                  ]
                    .filter(Boolean)
                    .join(" "),
                  confirmLabel: `Refund ${formatMoney(order.total)}`,
                  tone: "danger",
                  run: (done) => actions.refund.mutate(undefined, { onSettled: done }),
                })
              }
            >
              <RotateCcw className="size-4" strokeWidth={1.9} />
              Refund
            </Button>
          ) : null}
        </div>

        {order.status === "PACKED" ? (
          order.shiprocket.configured ? (
            <BookCourier order={order} actions={actions} busy={busy} ask={ask} />
          ) : (
            <ShipDialog
              ask={ask}
              onShip={(v, done) => actions.ship.mutate(v, { onSettled: done })}
              pending={actions.ship.isPending}
            />
          )
        ) : null}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Items */}
        <div className="bg-carbon rounded-md border border-white/[0.09]">
          <div className="text-dim border-b border-white/[0.07] px-6 py-4 font-mono text-[10px] tracking-[0.16em] uppercase">
            Items
          </div>
          <ul className="divide-y divide-white/[0.06]">
            {order.items.map((item) => (
              <li key={item.id} className="flex items-center gap-4 px-6 py-4">
                <span className="bg-blaze/12 text-blaze flex size-9 shrink-0 items-center justify-center rounded-lg font-mono text-[13px] font-bold">
                  {item.qty}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-bone block truncate text-[14.5px]">
                    {item.nameSnapshot}
                  </span>
                  <span className="text-dim block font-mono text-[11px]">{item.variant.sku}</span>
                </span>
                <Money
                  value={Number(item.unitPrice) * item.qty}
                  className="text-bone font-mono text-[14px]"
                />
              </li>
            ))}
          </ul>

          <div className="flex flex-col gap-3 border-t border-white/[0.07] px-6 py-5">
            <Row label="Subtotal" value={<Money value={order.subtotal} />} />
            {Number(order.discount) > 0 ? (
              <Row
                label="Discount"
                value={
                  <span className="text-acid">
                    − <Money value={order.discount} />
                  </span>
                }
              />
            ) : null}
            <Row
              label="Shipping"
              value={
                Number(order.shipping) === 0 ? (
                  <span className="text-acid">FREE</span>
                ) : (
                  <Money value={order.shipping} />
                )
              }
            />
            <div className="mt-2 flex items-baseline justify-between border-t border-white/[0.07] pt-4">
              <span className="text-bone text-[15px] font-semibold">Total</span>
              <Money value={order.total} className="font-display text-bone text-[28px]" />
            </div>
          </div>
        </div>

        {/* Customer + payment + shipment */}
        <div className="flex flex-col gap-5">
          <section className="bg-carbon rounded-md border border-white/[0.09] p-6">
            <div className="mb-4 flex items-center gap-2.5">
              <MapPin className="text-ember size-4" strokeWidth={1.9} />
              <h2 className="text-dim font-mono text-[10px] tracking-[0.16em] uppercase">
                Ship to
              </h2>
            </div>
            <address className="text-bone text-[14px] leading-[1.7] not-italic">
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
            <div className="text-ash mt-4 flex flex-col gap-1.5 border-t border-white/[0.07] pt-4 font-mono text-[12.5px]">
              <a href={`mailto:${order.email}`} className="hover:text-bone truncate">
                {order.email}
              </a>
              <a href={`tel:${order.phone}`} className="hover:text-bone">
                {order.phone}
              </a>
            </div>
          </section>

          <section className="bg-carbon rounded-md border border-white/[0.09] p-6">
            <div className="mb-4 flex items-center gap-2.5">
              <CreditCard className="text-violet size-4" strokeWidth={1.9} />
              <h2 className="text-dim font-mono text-[10px] tracking-[0.16em] uppercase">
                Payment
              </h2>
            </div>
            {order.payments.length === 0 ? (
              <p className="text-ash text-[13.5px]">
                Cash on delivery. Collect{" "}
                <Money value={order.total} className="text-bone font-mono" /> at the door.
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {order.payments.map((p) => (
                  <li key={p.gatewayOrderId} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-bone flex items-center gap-2 text-[13.5px] capitalize">
                        {p.gateway}
                        {/* Test money never arrives, so say so once live payments exist beside it. */}
                        {p.mode === "test" ? <Badge variant="violet">Test mode</Badge> : null}
                      </span>
                      <Badge variant={p.status === "CAPTURED" ? "acid" : "muted"}>{p.status}</Badge>
                    </div>
                    <span className="text-dim font-mono text-[11px] break-all">
                      {p.gatewayPaymentId ?? p.gatewayOrderId}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <InvoiceSection order={order} actions={actions} busy={busy} ask={ask} />

          {order.shipment ? (
            <section className="bg-carbon rounded-md border border-white/[0.09] p-6">
              <div className="mb-4 flex items-center gap-2.5">
                <Truck className="text-acid size-4" strokeWidth={1.9} />
                <h2 className="text-dim font-mono text-[10px] tracking-[0.16em] uppercase">
                  Shipment
                </h2>
              </div>
              <div className="flex flex-col gap-2 text-[13.5px]">
                <Row label="Courier" value={order.shipment.courier} />
                <Row label="AWB" value={order.shipment.awb ?? "-"} />
                <Row label="Status" value={readable(order.shipment.status)} />
                {order.shipment.statusAt ? (
                  <Row label="As of" value={when(order.shipment.statusAt)} />
                ) : null}
                {order.shipment.pickupScheduledAt && !order.shipment.deliveredAt ? (
                  <Row label="Pickup" value={when(order.shipment.pickupScheduledAt)} />
                ) : null}
                {order.shipment.etd && !order.shipment.deliveredAt ? (
                  <Row label="Expected" value={when(order.shipment.etd, false)} />
                ) : null}
                {order.shipment.deliveredAt ? (
                  <Row label="Delivered" value={when(order.shipment.deliveredAt)} />
                ) : null}
                <Row
                  label="Booked"
                  value={order.shipment.provider === "shiprocket" ? "Shiprocket" : "By hand"}
                />
              </div>

              {order.shipment.labelUrl ||
              order.shipment.manifestUrl ||
              order.shipment.trackingUrl ? (
                <div className="mt-4 flex flex-col gap-2 border-t border-white/[0.07] pt-4 text-[13px]">
                  {order.shipment.labelUrl ? (
                    <a
                      href={order.shipment.labelUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-ember hover:text-bone inline-flex items-center gap-2"
                    >
                      <FileText className="size-4" strokeWidth={1.9} />
                      Shipping label (PDF)
                    </a>
                  ) : null}
                  {order.shipment.manifestUrl ? (
                    <a
                      href={order.shipment.manifestUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-ember hover:text-bone inline-flex items-center gap-2"
                    >
                      <FileText className="size-4" strokeWidth={1.9} />
                      Manifest (PDF)
                    </a>
                  ) : null}
                  {order.shipment.trackingUrl ? (
                    <a
                      href={order.shipment.trackingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-ash hover:text-bone inline-flex items-center gap-2"
                    >
                      <ExternalLink className="size-4" strokeWidth={1.9} />
                      Live tracking
                    </a>
                  ) : null}
                </div>
              ) : null}

              {order.shipment.provider === "shiprocket" && order.shipment.awb ? (
                <div className="mt-4 flex flex-wrap gap-2.5 border-t border-white/[0.07] pt-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => actions.refreshTracking.mutate()}
                  >
                    <RefreshCw className="size-4" strokeWidth={1.9} />
                    Refresh tracking
                  </Button>
                  {order.status === "SHIPPED" && !order.shipment.labelUrl ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() => actions.book.mutate({})}
                    >
                      <FileText className="size-4" strokeWidth={1.9} />
                      Get label
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </section>
          ) : null}
        </div>
      </div>
    </div>
  )
}
