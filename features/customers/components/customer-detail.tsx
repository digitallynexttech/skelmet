"use client"

import * as React from "react"
import Link from "next/link"
import { MapPin, ShoppingBag, Users } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { Money } from "@/components/shared/money"
import { PageHeader } from "@/components/shared/page-header"
import { StatTile } from "@/components/shared/stat-tile"
import { StatusBadge } from "@/components/shared/status-badge"
import { DataTable, type Column } from "@/components/ui/data-table"
import {
  PAYMENT_METHOD_SHORT,
  statusLabelFor,
  type PaymentMethod,
} from "@/features/checkout/payment-options"
import type { CustomerDetail, CustomerOrder } from "@/features/customers/server/customers.service"
import { apiFetch } from "@/lib/api-fetch"
import type { OrderStatus } from "@/lib/constants"

/**
 * One customer: who they are, where their parcels go, and what they have
 * bought. Reached from the customer list, which is the only way in - there
 * are no customer accounts, so nobody arrives here but staff.
 */

const day = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "-"

/** The order's way of paying, as the orders table names it. */
const paymentLabel = (method: string) => PAYMENT_METHOD_SHORT[method as PaymentMethod] ?? method

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })

export function CustomerDetailView({ id }: { id: string }) {
  const [data, setData] = React.useState<CustomerDetail | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const res = await apiFetch<CustomerDetail>(`/api/admin/customers/${id}`)
        if (!cancelled) {
          setData(res)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load customer.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id])

  const columns: Column<CustomerOrder>[] = [
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
      key: "status",
      header: "Status",
      value: (o) => o.status,
      cell: (o) => (
        <StatusBadge
          status={o.status as OrderStatus}
          label={statusLabelFor(o.status, o.paymentMethod as PaymentMethod)}
        />
      ),
    },
    {
      key: "payment",
      header: "Payment",
      value: (o) => paymentLabel(o.paymentMethod),
      cell: (o) => (
        <span className="text-ash font-mono text-[12px]">{paymentLabel(o.paymentMethod)}</span>
      ),
    },
    {
      key: "items",
      header: "Items",
      align: "right",
      value: (o) => o.itemCount,
      cell: (o) => (
        <span className="text-ash text-[13.5px]">
          {o.itemCount} {o.itemCount === 1 ? "item" : "items"}
        </span>
      ),
    },
    {
      key: "total",
      header: "Total",
      align: "right",
      // Money is a string on the wire; as text "1000" sorts below "2".
      value: (o) => Number(o.total),
      cell: (o) => (
        <span className="text-bone font-mono text-[13.5px]">
          <Money value={o.total} />
        </span>
      ),
    },
    {
      key: "placed",
      header: "Placed",
      align: "right",
      value: (o) => o.placedAt ?? o.createdAt,
      cell: (o) => (
        <span className="text-dim font-mono text-[11.5px]">{when(o.placedAt ?? o.createdAt)}</span>
      ),
    },
  ]

  if (loading) {
    return (
      <div className="flex flex-col gap-5">
        <div className="h-7 w-64 animate-pulse rounded-md bg-white/5" />
        <div className="grid gap-4 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-md bg-white/5" />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-md bg-white/5" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader
          icon={Users}
          title="Customer"
          parent={{ label: "Customers", href: "/admin/customers" }}
        />
        <EmptyState title="Could not load this customer" description={error ?? undefined} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        icon={Users}
        title={data.name ?? "Unnamed customer"}
        parent={{ label: "Customers", href: "/admin/customers" }}
        subtitle={
          <>
            <a
              href={`mailto:${data.email}`}
              className="text-ash hover:text-bone font-mono text-[12.5px] transition-colors"
            >
              {data.email}
            </a>
            {data.phone ? (
              <>
                {" · "}
                <a
                  href={`tel:${data.phone}`}
                  className="text-ash hover:text-bone font-mono text-[12.5px] transition-colors"
                >
                  {data.phone}
                </a>
              </>
            ) : null}
            {` · Customer since ${day(data.createdAt)}`}
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Orders">{data.summary.orderCount}</StatTile>
        <StatTile label="Total spent">
          <Money value={data.summary.totalSpent} />
        </StatTile>
        <StatTile label="Average order">
          <Money value={data.summary.averageOrder} />
        </StatTile>
        <StatTile label="Last order">
          <span className="font-mono text-[15px]">{day(data.summary.lastOrderAt)}</span>
        </StatTile>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start">
        <div className="bg-carbon rounded-md border border-white/[0.09] p-5">
          <div className="mb-4 flex items-center gap-2.5">
            <MapPin className="text-ember size-4" strokeWidth={1.9} />
            <h2 className="text-bone text-[15px] font-semibold">Ships to</h2>
          </div>
          {data.address ? (
            <address className="text-bone text-[14px] leading-[1.7] not-italic">
              {data.address.name}
              <br />
              {data.address.line1}
              {data.address.line2 ? (
                <>
                  <br />
                  {data.address.line2}
                </>
              ) : null}
              <br />
              {data.address.city}, {data.address.state}
              <br />
              <span className="font-mono text-[13px]">{data.address.pincode}</span>
              <br />
              <span className="text-ash mt-2 inline-block font-mono text-[12.5px]">
                {data.address.phone}
              </span>
            </address>
          ) : (
            // Possible: a customer row exists the moment an order is written,
            // and an order that never reached payment carries no address.
            <p className="text-dim text-[13.5px] leading-[1.6]">
              No address on file. It is saved with the first completed order.
            </p>
          )}
        </div>

        <div>
          <div className="mb-3 flex items-center gap-2.5">
            <ShoppingBag className="text-ember size-4" strokeWidth={1.9} />
            <h2 className="text-bone text-[15px] font-semibold">Order history</h2>
          </div>
          <DataTable
            rows={data.orders}
            columns={columns}
            rowId={(o) => o.id}
            exportName={`orders-${data.email}`}
            compact
            pageSize={10}
            empty="No orders yet."
            exportColumns={[
              { header: "Order", value: (o) => o.number },
              { header: "Status", value: (o) => o.status },
              { header: "Payment", value: (o) => paymentLabel(o.paymentMethod) },
              { header: "Items", value: (o) => o.itemCount },
              { header: "Total", value: (o) => Number(o.total) },
              { header: "Placed", value: (o) => when(o.placedAt ?? o.createdAt) },
            ]}
          />
        </div>
      </div>
    </div>
  )
}
