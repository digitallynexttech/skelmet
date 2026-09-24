"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowLeft, Mail, MapPin, Phone, ShoppingBag } from "lucide-react"

import { Money } from "@/components/shared/money"
import { StatusBadge } from "@/components/shared/status-badge"
import { DataTable, type Column } from "@/components/ui/data-table"
import type { CustomerDetail, CustomerOrder } from "@/features/customers/server/customers.service"
import { apiFetch } from "@/lib/api-fetch"
import type { OrderStatus } from "@/lib/constants"

/**
 * One customer: who they are, where their parcels go, and what they have
 * bought. Reached from the customer list, which is the only way in — there
 * are no customer accounts, so nobody arrives here but staff.
 */

const day = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "—"

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md bg-carbon border border-white/[0.09] px-5 py-4">
      <div className="text-dim mb-1.5 font-mono text-[10px] tracking-[0.16em] uppercase">
        {label}
      </div>
      <div className="text-bone text-[20px] leading-none font-semibold">{children}</div>
    </div>
  )
}

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
      cell: (o) => <StatusBadge status={o.status as OrderStatus} />,
    },
    {
      key: "payment",
      header: "Payment",
      value: (o) => o.paymentMethod,
      cell: (o) => <span className="text-ash font-mono text-[12px]">{o.paymentMethod}</span>,
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
      <div className="flex flex-col gap-6">
        <div className="h-12 w-64 animate-pulse rounded-md bg-white/5" />
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
        <Link
          href="/admin/customers"
          className="text-ash hover:text-bone inline-flex items-center gap-2 text-[13.5px] transition-colors"
        >
          <ArrowLeft className="size-4" strokeWidth={2} />
          All customers
        </Link>
        <div className="border-magenta/35 bg-magenta/[0.06] rounded-md border p-5">
          <p className="text-bone text-[14px]">{error ?? "Could not load customer."}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/admin/customers"
          className="text-ash hover:text-bone mb-4 inline-flex items-center gap-2 text-[13.5px] transition-colors"
        >
          <ArrowLeft className="size-4" strokeWidth={2} />
          All customers
        </Link>

        <h1 className="font-display text-bone mb-2 text-[34px] leading-[1.05] uppercase sm:text-[40px]">
          {data.name ?? "Unnamed customer"}
        </h1>

        <div className="text-ash flex flex-wrap items-center gap-x-5 gap-y-2 text-[13.5px]">
          <a
            href={`mailto:${data.email}`}
            className="hover:text-bone flex items-center gap-1.5 font-mono text-[12.5px] transition-colors"
          >
            <Mail className="size-3.5" strokeWidth={1.9} />
            {data.email}
          </a>
          {data.phone ? (
            <a
              href={`tel:${data.phone}`}
              className="hover:text-bone flex items-center gap-1.5 font-mono text-[12.5px] transition-colors"
            >
              <Phone className="size-3.5" strokeWidth={1.9} />
              {data.phone}
            </a>
          ) : null}
          <span className="text-dim font-mono text-[12px]">
            Customer since {day(data.createdAt)}
          </span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Orders">{data.summary.orderCount}</Stat>
        <Stat label="Total spent">
          <Money value={data.summary.totalSpent} />
        </Stat>
        <Stat label="Average order">
          <Money value={data.summary.averageOrder} />
        </Stat>
        <Stat label="Last order">
          <span className="font-mono text-[15px]">{day(data.summary.lastOrderAt)}</span>
        </Stat>
      </div>

      <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start">
        <div className="rounded-md bg-carbon border border-white/[0.09] p-5">
          <div className="text-dim mb-4 flex items-center gap-2 font-mono text-[10px] tracking-[0.16em] uppercase">
            <MapPin className="text-ember size-3.5" strokeWidth={1.9} />
            Ships to
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
          <div className="text-dim mb-3 flex items-center gap-2 font-mono text-[10px] tracking-[0.16em] uppercase">
            <ShoppingBag className="text-ember size-3.5" strokeWidth={1.9} />
            Order history
          </div>
          <DataTable
            rows={data.orders}
            columns={columns}
            rowId={(o) => o.id}
            exportName={`orders-${data.email}`}
            pageSize={10}
            empty="No orders yet."
            exportColumns={[
              { header: "Order", value: (o) => o.number },
              { header: "Status", value: (o) => o.status },
              { header: "Payment", value: (o) => o.paymentMethod },
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
