"use client"

import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { BoardTile } from "@/components/shared/board-tile"
import { EmptyState } from "@/components/shared/empty-state"
import { Money } from "@/components/shared/money"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { Badge } from "@/components/ui/badge"
import { DataTable, type Column } from "@/components/ui/data-table"
import {
  useCouponHistory,
  type CouponEvent,
  type CouponHistoryOrder,
  type CouponRun,
  type CouponTerms,
} from "@/features/coupons/hooks/use-coupons"
import type { OrderStatus } from "@/lib/constants"
import { formatMoney } from "@/lib/money"

const STATE_TONE = { ACTIVE: "acid", EXPIRED: "muted", EXHAUSTED: "ember" } as const

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
const moment = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

function termsText(t: CouponTerms | null): string {
  if (!t) return "Not recorded"
  const off = t.kind === "PERCENT" ? `${Number(t.value)}% off` : `${formatMoney(t.value)} off`
  const min = Number(t.minSubtotal ?? 0) > 0 ? ` over ${formatMoney(t.minSubtotal!)}` : ""
  const max = t.maxUses ? `, ${t.maxUses} uses` : ""
  return `${off}${min}${max}`
}

/** What each log entry says, in words. */
const ACTION: Record<string, string> = {
  "coupon:create": "Created",
  "coupon:update": "Edited",
  "coupon:expire": "Expired",
  "coupon:archive": "Archived",
  "coupon:restore": "Restored from the archive",
  "coupon:renew": "Renewed",
}

function eventDetail(e: CouponEvent): string | null {
  const m = e.meta ?? {}
  if (e.action === "coupon:renew") {
    const parts = [
      m.kind && m.value !== undefined
        ? termsText({
            kind: m.kind as "PERCENT" | "FLAT",
            value: String(m.value),
            minSubtotal: m.minSubtotal !== undefined ? String(m.minSubtotal) : null,
            maxUses: typeof m.maxUses === "number" ? m.maxUses : null,
          })
        : null,
      typeof m.previousUses === "number" ? `${m.previousUses} uses in the run before` : null,
      m.wasArchived ? "brought out of the archive" : null,
    ].filter(Boolean)
    return parts.join(" · ") || null
  }
  if (e.action === "coupon:create" && m.kind && m.value !== undefined) {
    return termsText({
      kind: m.kind as "PERCENT" | "FLAT",
      value: String(m.value),
      minSubtotal: m.minSubtotal !== undefined ? String(m.minSubtotal) : null,
      maxUses: typeof m.maxUses === "number" ? m.maxUses : null,
    })
  }
  if (e.action === "coupon:update") {
    const said: string[] = []
    if (m.showInCart !== undefined)
      said.push(m.showInCart ? "shown in the cart" : "taken out of the cart")
    if (m.value !== undefined) said.push(`amount ${String(m.value)}`)
    if (m.kind !== undefined)
      said.push(m.kind === "PERCENT" ? "made a percentage" : "made a flat amount")
    if (m.minSubtotal !== undefined) said.push(`minimum ${formatMoney(Number(m.minSubtotal))}`)
    if (m.maxUses !== undefined)
      said.push(m.maxUses === null ? "uses unlimited" : `max uses ${String(m.maxUses)}`)
    if (m.expiresAt !== undefined)
      said.push(m.expiresAt ? `expiry ${day(String(m.expiresAt))}` : "no expiry")
    return said.join(", ") || null
  }
  return null
}

/**
 * One discount code, from the day it was made: each run it has had (it can
 * be renewed, year after year), the orders placed with it, and who did what
 * to it when. Opened from its row in Offers & codes.
 */
export function CouponHistoryView({ id }: { id: string }) {
  const { data, isLoading, isError, error } = useCouponHistory(id)

  const back = (
    <Link
      href="/admin/coupons"
      className="text-ash hover:text-bone inline-flex items-center gap-2 text-[13.5px] transition-colors"
    >
      <ArrowLeft className="size-4" strokeWidth={2} />
      Offers &amp; codes
    </Link>
  )

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        {back}
        <div className="h-16 w-64 animate-pulse rounded-md bg-white/5" />
        <div className="h-64 animate-pulse rounded-md bg-white/5" />
      </div>
    )
  }
  if (isError || !data) {
    return (
      <div className="flex flex-col gap-6">
        {back}
        <EmptyState
          title="Could not load this code"
          description={error instanceof Error ? error.message : "It may have been removed."}
        />
      </div>
    )
  }

  const { coupon, runs, orders, events, canSeeOrders } = data
  const all = runs.reduce(
    (t, r) => ({
      orders: t.orders + r.orders,
      discount: t.discount + r.discount,
      sales: t.sales + r.sales,
      refunded: t.refunded + r.refunded,
    }),
    { orders: 0, discount: 0, sales: 0, refunded: 0 },
  )

  const runColumns: Column<CouponRun>[] = [
    {
      key: "run",
      header: "Run",
      value: (r) => r.index,
      cell: (r) => (
        <div>
          <div className="text-bone text-[14px] font-semibold">
            {r.end === null ? "Now" : `Run ${r.index}`}
          </div>
          <div className="text-dim text-[12px]">
            {r.startedBy === "created" ? "Created" : "Renewed"} {day(r.start)}
          </div>
        </div>
      ),
    },
    {
      key: "dates",
      header: "Ran until",
      value: (r) => r.end ?? r.expiresAt ?? "",
      cell: (r) => (
        <span className="text-ash text-[13px]">
          {r.expiresAt ? day(r.expiresAt) : r.end ? `renewed ${day(r.end)}` : "no expiry"}
        </span>
      ),
    },
    {
      key: "terms",
      header: "Terms",
      value: (r) => termsText(r.terms),
      cell: (r) => <span className="text-bone text-[13.5px]">{termsText(r.terms)}</span>,
    },
    {
      key: "orders",
      header: "Orders",
      align: "right",
      value: (r) => r.orders,
      cell: (r) => (
        <span className="text-bone font-mono text-[13px]">
          {r.orders}
          {r.refunded > 0 ? <span className="text-dim"> +{r.refunded} refunded</span> : null}
        </span>
      ),
    },
    {
      key: "discount",
      header: "Discount given",
      align: "right",
      value: (r) => r.discount,
      cell: (r) => <Money value={r.discount} className="text-acid font-mono text-[13px]" />,
    },
    {
      key: "sales",
      header: "Sales",
      align: "right",
      value: (r) => r.sales,
      cell: (r) => <Money value={r.sales} className="text-bone font-mono text-[13px]" />,
    },
  ]

  const orderColumns: Column<CouponHistoryOrder>[] = [
    {
      key: "number",
      header: "Order",
      value: (o) => o.number,
      cell: (o) => (
        <Link
          href={`/admin/orders/${o.id}`}
          className="text-bone hover:text-blaze font-mono text-[13px] transition-colors"
        >
          {o.number}
        </Link>
      ),
    },
    {
      key: "at",
      header: "Placed",
      value: (o) => o.at,
      cell: (o) => <span className="text-ash text-[13px]">{moment(o.at)}</span>,
    },
    {
      key: "customer",
      header: "Customer",
      value: (o) => o.customer,
      cell: (o) => (
        <div className="min-w-0">
          <div className="text-bone truncate text-[13.5px]">{o.customer}</div>
          <div className="text-dim truncate text-[12px]">{o.email}</div>
        </div>
      ),
    },
    {
      key: "run",
      header: "Run",
      value: (o) => o.run,
      cell: (o) => (
        <span className="text-dim font-mono text-[12px]">
          {o.run === runs[0]?.index ? "now" : `run ${o.run}`}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      value: (o) => o.status,
      cell: (o) => <StatusBadge status={o.status as OrderStatus} />,
    },
    {
      key: "discount",
      header: "Discount",
      align: "right",
      value: (o) => Number(o.discount),
      cell: (o) => <Money value={o.discount} className="text-acid font-mono text-[13px]" />,
    },
    {
      key: "total",
      header: "Total",
      align: "right",
      value: (o) => Number(o.total),
      cell: (o) => <Money value={o.total} className="text-bone font-mono text-[13px]" />,
    },
  ]

  return (
    <div className="flex flex-col gap-7">
      {back}

      <PageHeader
        eyebrow="Discount code"
        title={coupon.code}
        description={`${termsText(coupon)}. ${
          coupon.expiresAt ? `Expires ${day(coupon.expiresAt)}` : "No expiry"
        }. ${coupon.showInCart ? "Offered in the cart." : "Not offered in the cart."}`}
        actions={
          <div className="flex items-center gap-2">
            {coupon.archivedAt ? <Badge variant="muted">Archived</Badge> : null}
            <Badge variant={STATE_TONE[coupon.state]}>{coupon.state}</Badge>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <BoardTile label="Orders, all runs" value={all.orders} empty={all.orders === 0} />
        <BoardTile
          label="Discount given"
          value={formatMoney(all.discount)}
          tone="text-acid"
          empty={all.discount === 0}
        />
        <BoardTile label="Sales with it" value={formatMoney(all.sales)} empty={all.sales === 0} />
        <BoardTile label="Runs" value={runs.length} />
      </div>
      {all.refunded > 0 ? (
        <p className="text-dim -mt-3 text-[12.5px]">
          Plus {all.refunded} {all.refunded === 1 ? "order" : "orders"} placed with it and later
          refunded or returned, not counted above.
        </p>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-bone text-[22px] uppercase">Runs</h2>
        <p className="text-dim -mt-1 text-[13px]">
          Each renewal starts a run. Orders count once placed; unpaid and cancelled ones do not.
        </p>
        <DataTable
          rows={runs}
          columns={runColumns}
          rowId={(r) => String(r.index)}
          exportName={`${coupon.code.toLowerCase()}-runs`}
          empty="No runs yet."
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-bone text-[22px] uppercase">Orders with this code</h2>
        {canSeeOrders ? (
          <DataTable
            rows={orders}
            columns={orderColumns}
            rowId={(o) => o.id}
            exportName={`${coupon.code.toLowerCase()}-orders`}
            empty="No orders have used this code yet."
            exportColumns={[
              { header: "Order", value: (o) => o.number },
              { header: "Placed", value: (o) => moment(o.at) },
              { header: "Customer", value: (o) => o.customer },
              { header: "Email", value: (o) => o.email },
              { header: "Run", value: (o) => o.run },
              { header: "Status", value: (o) => o.status },
              { header: "Subtotal", value: (o) => Number(o.subtotal) },
              { header: "Discount", value: (o) => Number(o.discount) },
              { header: "Total", value: (o) => Number(o.total) },
            ]}
          />
        ) : (
          <p className="text-ash text-[13.5px]">
            The orders themselves need the View orders permission. The totals above include them.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-bone text-[22px] uppercase">Log</h2>
        {events.length === 0 ? (
          <p className="text-ash text-[13.5px]">Nothing recorded for this code.</p>
        ) : (
          <ol className="bg-carbon divide-y divide-white/[0.06] rounded-md border border-white/[0.09]">
            {events.map((e, i) => {
              const detail = eventDetail(e)
              return (
                <li
                  key={i}
                  className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-baseline sm:gap-4"
                >
                  <span className="text-dim w-44 shrink-0 font-mono text-[12px]">
                    {moment(e.at)}
                  </span>
                  <span className="text-bone text-[13.5px] font-semibold">
                    {ACTION[e.action] ?? e.action}
                  </span>
                  {detail ? <span className="text-ash text-[13px]">{detail}</span> : null}
                  <span className="text-dim text-[12.5px] sm:ml-auto">{e.by ?? "System"}</span>
                </li>
              )
            })}
          </ol>
        )}
      </section>
    </div>
  )
}
