"use client"

import * as React from "react"
import Link from "next/link"
import { ChevronLeft, ChevronRight, Search } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { Money } from "@/components/shared/money"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { Input } from "@/components/ui/input"
import { useOrders } from "@/features/orders/hooks/use-orders"
import { ORDER_STATUSES, type OrderStatus } from "@/lib/constants"
import { useDebounce } from "@/hooks/use-debounce"
import { useUrlState } from "@/hooks/use-url-state"
import { cn } from "@/lib/utils"

const FILTERS: Array<{ label: string; value: OrderStatus | "ALL" }> = [
  { label: "All", value: "ALL" },
  ...ORDER_STATUSES.map((s) => ({
    label: s.charAt(0) + s.slice(1).toLowerCase(),
    value: s as OrderStatus,
  })),
]

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function OrderTable() {
  // List state lives in the URL, so a filtered view is shareable (§6).
  const [state, setState] = useUrlState({ page: "1", status: "ALL", q: "" })
  const [rawQuery, setRawQuery] = React.useState(state.q)
  const debounced = useDebounce(rawQuery, 350)

  React.useEffect(() => {
    if (debounced !== state.q) setState({ q: debounced, page: "1" })
  }, [debounced, state.q, setState])

  const page = Math.max(1, Number(state.page) || 1)
  const status = state.status as OrderStatus | "ALL"

  const { data, isLoading, isError, error } = useOrders({ page, status, q: state.q })
  const pagination = data?.pagination

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        eyebrow="Console"
        title="Orders"
        description="Every order, newest first. Search by order number, email or phone."
      />

      <div className="flex flex-col gap-4">
        <div className="relative max-w-[420px]">
          <Search
            className="text-dim pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2"
            strokeWidth={1.9}
          />
          <Input
            value={rawQuery}
            onChange={(e) => setRawQuery(e.target.value)}
            placeholder="SKM-2026-4F2K, email or phone"
            aria-label="Search orders"
            className="pl-11"
          />
        </div>

        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 sm:mx-0 sm:flex-wrap sm:px-0">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setState({ status: f.value, page: "1" })}
              className={cn(
                "min-h-9 shrink-0 rounded-full border px-4 text-[12.5px] transition-colors",
                status === f.value
                  ? "border-blaze bg-blaze/12 text-bone font-semibold"
                  : "text-ash border-white/[0.12] hover:border-white/25",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {isError ? (
        <EmptyState
          title="Could not load orders"
          description={error instanceof Error ? error.message : undefined}
        />
      ) : isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-white/5" />
          ))}
        </div>
      ) : !data || data.data.length === 0 ? (
        <EmptyState
          title="Nothing matches"
          description="Try a different status or clear the search."
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="rounded-card hidden overflow-hidden border border-white/[0.09] lg:block">
            <div className="bg-carbon text-dim grid grid-cols-[150px_130px_minmax(0,1fr)_120px_110px_150px] gap-4 border-b border-white/[0.07] px-5 py-3.5 font-mono text-[10px] tracking-[0.16em] uppercase">
              <span>Order</span>
              <span>Status</span>
              <span>Customer</span>
              <span>Items</span>
              <span className="text-right">Total</span>
              <span className="text-right">Placed</span>
            </div>
            {data.data.map((order) => (
              <Link
                key={order.id}
                href={`/admin/orders/${order.id}`}
                className="grid grid-cols-[150px_130px_minmax(0,1fr)_120px_110px_150px] items-center gap-4 border-b border-white/[0.06] px-5 py-4 transition-colors last:border-b-0 hover:bg-white/[0.03]"
              >
                <span className="text-bone font-mono text-[13px]">{order.number}</span>
                <StatusBadge status={order.status} />
                <span className="min-w-0">
                  <span className="text-bone block truncate text-[14px]">{order.customer}</span>
                  <span className="text-dim block truncate font-mono text-[11px]">
                    {order.email}
                  </span>
                </span>
                <span className="text-ash text-[13.5px]">
                  {order.itemCount} {order.itemCount === 1 ? "item" : "items"}
                </span>
                <span className="text-bone text-right font-mono text-[13.5px]">
                  <Money value={order.total} />
                </span>
                <span className="text-dim text-right font-mono text-[11.5px]">
                  {fmtDate(order.placedAt ?? order.createdAt)}
                </span>
              </Link>
            ))}
          </div>

          {/* Mobile cards */}
          <div className="flex flex-col gap-3 lg:hidden">
            {data.data.map((order) => (
              <Link
                key={order.id}
                href={`/admin/orders/${order.id}`}
                className="rounded-card bg-carbon border border-white/[0.09] p-5"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="text-bone font-mono text-[13px]">{order.number}</span>
                  <StatusBadge status={order.status} />
                </div>
                <div className="text-bone mb-1 truncate text-[14.5px]">{order.customer}</div>
                <div className="text-dim mb-3 truncate font-mono text-[11px]">{order.email}</div>
                <div className="flex items-center justify-between">
                  <span className="text-ash text-[13px]">
                    {order.itemCount} {order.itemCount === 1 ? "item" : "items"}
                  </span>
                  <Money value={order.total} className="font-display text-bone text-[22px]" />
                </div>
              </Link>
            ))}
          </div>

          {pagination && pagination.totalPages > 1 ? (
            <div className="flex items-center justify-between">
              <span className="text-dim font-mono text-[11.5px]">
                Page {pagination.page} of {pagination.totalPages} · {pagination.total} orders
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setState({ page: String(page - 1) })}
                  className="text-bone flex size-10 items-center justify-center rounded-xl border border-white/[0.12] disabled:opacity-35"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="size-4" strokeWidth={2} />
                </button>
                <button
                  type="button"
                  disabled={page >= pagination.totalPages}
                  onClick={() => setState({ page: String(page + 1) })}
                  className="text-bone flex size-10 items-center justify-center rounded-xl border border-white/[0.12] disabled:opacity-35"
                  aria-label="Next page"
                >
                  <ChevronRight className="size-4" strokeWidth={2} />
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
