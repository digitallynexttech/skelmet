"use client"

import * as React from "react"
import Link from "next/link"
import { useQueryClient } from "@tanstack/react-query"
import {
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
  ShoppingBag,
  Truck,
} from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { Money } from "@/components/shared/money"
import { PageHeader } from "@/components/shared/page-header"
import { ToneBadge } from "@/components/shared/status-badge"
import { Badge } from "@/components/ui/badge"
import { HeaderButton, headerButton } from "@/components/ui/header-button"
import { Field, Input } from "@/components/ui/input"
import { PAYMENT_METHOD_LABEL, type PaymentMethod } from "@/features/checkout/payment-options"
import {
  useCourierOptions,
  useOrder,
  useOrderAction,
  type OrderDetail,
} from "@/features/orders/hooks/use-orders"
import {
  FULFILMENT_STATES,
  PAYMENT_STATES,
  fulfilmentState,
  paymentState,
} from "@/features/orders/order-progress"
import { useConfirm, type Ask } from "@/hooks/use-confirm"
import { PAID_ORDER_STATUSES, type OrderStatus } from "@/lib/constants"
import { formatMoney } from "@/lib/money"
import { cn } from "@/lib/utils"

const TIMELINE: Array<{ status: OrderStatus; label: string; Icon: typeof Truck }> = [
  { status: "PAID", label: "Paid", Icon: CreditCard },
  { status: "PACKED", label: "Packed", Icon: PackageCheck },
  { status: "SHIPPED", label: "Shipped", Icon: Truck },
  { status: "DELIVERED", label: "Delivered", Icon: Home },
]

/** CONFIRMED is COD's first step, PAID everyone else's. */
const ORDER_OF = (s: OrderStatus) =>
  s === "CONFIRMED" ? 0 : TIMELINE.findIndex((t) => t.status === s)

const FIRST_STEP: Record<PaymentMethod, string> = {
  ONLINE: "Paid",
  PARTIAL: "Advance paid",
  COD: "Confirmed",
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-[14px]">
      <span className="text-ash">{label}</span>
      <span className="text-bone text-right font-mono">{value}</span>
    </div>
  )
}

/** "IN TRANSIT" -> "In transit". */
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

// A booking with an AWB but no pickup shows "Finish booking", which keeps that AWB
// rather than booking (and charging for) a second courier.
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
      <h2 className="text-bone mb-4 text-[15px] font-semibold">Book a courier · Shiprocket</h2>

      {kept ? (
        <div className="flex flex-col gap-3">
          <p className="text-ash text-[13.5px] leading-[1.55]">
            <span className="text-bone">{kept.courier}</span> is booked with AWB{" "}
            <span className="text-bone font-mono">{kept.awb}</span>, but the pickup is not scheduled
            yet. Finishing carries on from there - it keeps this AWB.
          </p>
          <div>
            <HeaderButton
              variant="primary"
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
            </HeaderButton>
          </div>
        </div>
      ) : !asked ? (
        <div className="flex flex-wrap gap-2.5">
          <HeaderButton variant="primary" disabled={busy} onClick={() => setAsked(true)}>
            <Truck className="size-4" strokeWidth={1.9} />
            Show couriers &amp; rates
          </HeaderButton>
          <HeaderButton
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
          </HeaderButton>
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
          <HeaderButton onClick={() => void couriers.refetch()}>
            <RefreshCw className="size-4" strokeWidth={1.9} />
            Try again
          </HeaderButton>
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
            <HeaderButton
              variant="primary"
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
            </HeaderButton>
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
      <h2 className="text-bone mb-4 text-[15px] font-semibold">Mark shipped</h2>
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
        <HeaderButton type="submit" variant="primary" disabled={pending}>
          <Truck className="size-4" strokeWidth={1.9} />
          Confirm shipped
        </HeaderButton>
        {children}
      </div>
    </form>
  )
}

/** Must match the server's rule. */
const INVOICEABLE: OrderStatus[] = ["PAID", "PACKED", "SHIPPED", "DELIVERED"]

/** The invoice is replaced by a credit note (invoice.service). */
const CREDITED: OrderStatus[] = ["REFUNDED", "CANCELLED"]

type CreditNote = { creditNoteNumber?: string | null; creditedAt?: string | null }

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
  const credit = order as OrderDetail & CreditNote
  const refreshSoon = () =>
    window.setTimeout(() => void qc.invalidateQueries({ queryKey: ["orders", order.id] }), 2500)

  // Paid on Razorpay's test account: not a sale, so no tax invoice.
  const testMode = order.payments.some(
    (p) => p.mode === "test" && (p.status === "CAPTURED" || p.status === "REFUNDED"),
  )
  if (testMode) {
    return (
      <section className="bg-carbon rounded-md border border-white/[0.09] p-6">
        <div className="mb-4 flex items-center gap-2.5">
          <FileText className="text-ember size-4" strokeWidth={1.9} />
          <h2 className="text-bone text-[15px] font-semibold">Invoice</h2>
        </div>
        <p className="text-ash text-[13.5px]">
          Test-mode orders don&apos;t get tax invoices: no money changed hands.
        </p>
      </section>
    )
  }

  if (order.invoiceNumber && CREDITED.includes(order.status)) {
    return (
      <section className="bg-carbon rounded-md border border-white/[0.09] p-6">
        <div className="mb-4 flex items-center gap-2.5">
          <FileText className="text-ember size-4" strokeWidth={1.9} />
          <h2 className="text-bone text-[15px] font-semibold">Credit note</h2>
        </div>
        <div className="flex flex-col gap-2 text-[13.5px]">
          {credit.creditNoteNumber ? (
            <>
              <Row
                label="Number"
                value={<span className="font-mono">{credit.creditNoteNumber}</span>}
              />
              <Row label="Dated" value={when(credit.creditedAt ?? null, false)} />
            </>
          ) : (
            <p className="text-ash">
              Opening it for the first time gives it the next credit note number and today&apos;s
              date.
            </p>
          )}
          <Row
            label="Cancels invoice"
            value={<span className="font-mono">{order.invoiceNumber}</span>}
          />
          <Row label="Invoice dated" value={when(order.invoicedAt, false)} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2.5 border-t border-white/[0.07] pt-4">
          <a
            href={`/api/admin/orders/${order.id}/credit-note`}
            target="_blank"
            rel="noreferrer"
            className={headerButton({ variant: "primary" })}
            onClick={refreshSoon}
          >
            <Printer className="size-4" strokeWidth={1.9} />
            Print credit note
          </a>
        </div>
      </section>
    )
  }

  return (
    <section className="bg-carbon rounded-md border border-white/[0.09] p-6">
      <div className="mb-4 flex items-center gap-2.5">
        <FileText className="text-ember size-4" strokeWidth={1.9} />
        <h2 className="text-bone text-[15px] font-semibold">Invoice</h2>
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
          className={headerButton({ variant: "primary" })}
          // The first open issues the number; show it once it has.
          onClick={refreshSoon}
        >
          <Printer className="size-4" strokeWidth={1.9} />
          Print invoice
        </a>
        <HeaderButton
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
        </HeaderButton>
      </div>
    </section>
  )
}

export function OrderDetailView({ id }: { id: string }) {
  const { data: order, isLoading, isError, error } = useOrder(id)
  const actions = useOrderAction(id)

  // Every action that moves the order, charges the wallet or refunds asks first.
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
  // Refund restocks what never left; must match the server.
  const unshipped = order.status === "PAID" || order.status === "PACKED"
  // Only what came through Razorpay can be refunded through it.
  const captured = order.payments.find((p) => p.status === "CAPTURED")
  const due = Number(order.dueOnDelivery)
  // Orders lists only paid ones.
  const back = (PAID_ORDER_STATUSES as readonly OrderStatus[]).includes(order.status)
    ? { href: "/admin/orders", label: "Orders" }
    : { href: "/admin/orders/all", label: "All orders" }
  // Who cancelled is the list's to say; here it just reads Cancelled.
  const payment = paymentState(order.status, order.paymentMethod)
  const fulfilment = fulfilmentState(order.status, {
    shipped: order.shipment != null && order.shipment.status.toUpperCase() !== "CANCELLED",
    cancelledByStaff: true,
  })

  return (
    <div className="flex flex-col gap-5">
      {dialog}
      <PageHeader
        icon={ShoppingBag}
        parent={back}
        title={<span className="font-mono">{order.number}</span>}
        tags={
          <>
            <ToneBadge tone={PAYMENT_STATES[payment].tone}>
              {PAYMENT_STATES[payment].label}
            </ToneBadge>
            <ToneBadge tone={FULFILMENT_STATES[fulfilment].tone}>
              {order.status === "CANCELLED" ? "Cancelled" : FULFILMENT_STATES[fulfilment].label}
            </ToneBadge>
            {order.coupon ? <Badge variant="acid">{order.coupon.code}</Badge> : null}
          </>
        }
        subtitle={`Placed ${new Date(order.placedAt ?? order.createdAt).toLocaleString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })} · ${PAYMENT_METHOD_LABEL[order.paymentMethod]}`}
      />

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
                    {i === 0 ? FIRST_STEP[order.paymentMethod] : step.label}
                  </span>
                </li>
              )
            })}
          </ol>
        </div>
      ) : null}

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2.5">
          {order.status === "PAID" ||
          order.status === "CONFIRMED" ||
          (order.status === "PENDING" && order.paymentMethod === "COD") ? (
            <HeaderButton
              variant="primary"
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
            </HeaderButton>
          ) : null}
          {order.status === "SHIPPED" ? (
            <HeaderButton
              variant="primary"
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
            </HeaderButton>
          ) : null}
          {/* Unpaid only: a paid order goes through Refund. */}
          {order.status === "PENDING" || order.status === "CONFIRMED" ? (
            <HeaderButton
              disabled={busy}
              onClick={() =>
                ask({
                  title: "Cancel this order?",
                  body: `${order.number} was never paid, so there is nothing to refund. It is cancelled and its ${unitsText} go back into stock.${
                    order.shiprocket.orderId ? " It is cancelled in Shiprocket too." : ""
                  } This cannot be undone.`,
                  confirmLabel: "Cancel order",
                  tone: "danger",
                  run: (done) => actions.cancel.mutate(undefined, { onSettled: done }),
                })
              }
            >
              <Ban className="size-4" strokeWidth={1.9} />
              Cancel &amp; restock
            </HeaderButton>
          ) : null}
          {["PAID", "PACKED", "SHIPPED", "DELIVERED", "RETURNED"].includes(order.status) ||
          (order.status === "CANCELLED" && order.payments.some((p) => p.status === "CAPTURED")) ? (
            <HeaderButton
              disabled={busy}
              onClick={() =>
                ask({
                  title: captured ? `Refund ${formatMoney(captured.amount)}?` : "Mark as refunded?",
                  body: [
                    captured
                      ? order.paymentMethod === "PARTIAL"
                        ? `The advance of ${formatMoney(captured.amount)} goes back to the customer's original payment method through Razorpay.`
                        : `The full ${formatMoney(captured.amount)} goes back to the customer's original payment method through Razorpay.`
                      : "No captured payment is on file, so no money moves through Razorpay. The order is only marked refunded.",
                    due > 0 && !unshipped
                      ? `If the courier collected the ${formatMoney(due)} due on delivery, that has to be returned to the customer by hand.`
                      : "",
                    unshipped ? `Its ${unitsText} go back into stock.` : "Stock is not changed.",
                    unshipped && order.shiprocket.orderId
                      ? "The order is cancelled in Shiprocket too."
                      : "",
                    "This cannot be undone.",
                  ]
                    .filter(Boolean)
                    .join(" "),
                  confirmLabel: captured
                    ? `Refund ${formatMoney(captured.amount)}`
                    : "Mark refunded",
                  tone: "danger",
                  run: (done) => actions.refund.mutate(undefined, { onSettled: done }),
                })
              }
            >
              <RotateCcw className="size-4" strokeWidth={1.9} />
              Refund
            </HeaderButton>
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

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="bg-carbon rounded-md border border-white/[0.09]">
          <h2 className="text-bone border-b border-white/[0.07] px-6 py-4 text-[15px] font-semibold">
            Items
          </h2>
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
            {Number(order.paymentFee) > 0 ? (
              <Row label="Pay-on-delivery charge" value={<Money value={order.paymentFee} />} />
            ) : null}
            <div className="mt-2 flex items-baseline justify-between border-t border-white/[0.07] pt-4">
              <span className="text-bone text-[15px] font-semibold">Total</span>
              <Money value={order.total} className="text-bone text-[22px] font-semibold" />
            </div>
            {due > 0 ? (
              <>
                {order.paymentMethod === "PARTIAL" ? (
                  <Row
                    label="Advance, online"
                    value={<Money value={Number(order.total) - due} />}
                  />
                ) : null}
                <Row
                  label="To collect on delivery"
                  value={
                    <span className="text-ember">
                      <Money value={due} />
                    </span>
                  }
                />
              </>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <section className="bg-carbon rounded-md border border-white/[0.09] p-6">
            <div className="mb-4 flex items-center gap-2.5">
              <MapPin className="text-ember size-4" strokeWidth={1.9} />
              <h2 className="text-bone text-[15px] font-semibold">Ship to</h2>
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
              <h2 className="text-bone text-[15px] font-semibold">Payment</h2>
            </div>
            {order.paymentMethod !== "ONLINE" ? (
              <p className={cn("text-ash text-[13.5px]", order.payments.length > 0 && "mb-4")}>
                {order.paymentMethod === "PARTIAL"
                  ? "An advance online, the rest on delivery."
                  : "Cash on delivery."}{" "}
                {order.status === "DELIVERED"
                  ? "The courier collected"
                  : dead || order.status === "RETURNED"
                    ? "The courier was to collect"
                    : "The courier collects"}{" "}
                <Money value={due > 0 ? due : order.total} className="text-bone font-mono" /> at the
                door.
              </p>
            ) : order.payments.length === 0 ? (
              <p className="text-ash text-[13.5px]">No payment was started for this order.</p>
            ) : null}
            {order.payments.length === 0 ? null : (
              <ul className="flex flex-col gap-3">
                {order.payments.map((p) => (
                  <li key={p.gatewayOrderId} className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                      <span className="text-bone flex items-center gap-2 text-[13.5px] capitalize">
                        {p.gateway}
                        {p.mode === "test" ? <Badge variant="violet">Test mode</Badge> : null}
                      </span>
                      <span className="flex items-center gap-2.5">
                        <Money value={p.amount} className="text-bone font-mono text-[13px]" />
                        <Badge variant={p.status === "CAPTURED" ? "acid" : "muted"}>
                          {p.status}
                        </Badge>
                      </span>
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
                <h2 className="text-bone text-[15px] font-semibold">Shipment</h2>
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
                  <HeaderButton disabled={busy} onClick={() => actions.refreshTracking.mutate()}>
                    <RefreshCw className="size-4" strokeWidth={1.9} />
                    Refresh tracking
                  </HeaderButton>
                  {order.status === "SHIPPED" && !order.shipment.labelUrl ? (
                    <HeaderButton disabled={busy} onClick={() => actions.book.mutate({})}>
                      <FileText className="size-4" strokeWidth={1.9} />
                      Get label
                    </HeaderButton>
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
