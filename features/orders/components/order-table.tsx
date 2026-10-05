"use client"

import * as React from "react"
import Link from "next/link"
import { Search } from "lucide-react"

import { BoardTile } from "@/components/shared/board-tile"
import { EmptyState } from "@/components/shared/empty-state"
import { Money } from "@/components/shared/money"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { DataTable, type Column } from "@/components/ui/data-table"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { PAYMENT_METHOD_SHORT, statusLabelFor } from "@/features/checkout/payment-options"
import { useOrders, type OrderRow } from "@/features/orders/hooks/use-orders"
import {
  ORDER_STATUS_COLORS,
  ORDER_STATUS_LABELS,
  statusesIn,
  type OrderScope,
  type OrderStatus,
} from "@/lib/constants"
import { useDebounce } from "@/hooks/use-debounce"
import { useUrlState } from "@/hooks/use-url-state"
import { cn } from "@/lib/utils"

/**
 * The two boards one table serves. Orders is the working list - paid, or
 * cash on delivery accepted, and everything that happens after. All orders
 * adds the ones never paid for, which Abandoned carts follows up on.
 */
const SCOPES: Record<
  OrderScope,
  { title: string; description: string; all: string; exportName: string; tiles: string }
> = {
  paid: {
    title: "Orders",
    description:
      "Orders to fulfil - paid, or cash on delivery - and every stage after, newest first. Ones still waiting for an online payment are under All orders and Abandoned carts. Search by order number, email or phone.",
    all: "All to fulfil",
    exportName: "orders",
    // Eight tiles: two rows of four, or one row once there is room.
    tiles: "lg:grid-cols-4 xl:grid-cols-8",
  },
  all: {
    title: "All orders",
    description: "Every order, paid or not, newest first. Search by order number, email or phone.",
    all: "All",
    exportName: "all-orders",
    // Ten tiles: two rows of five. In one row each was too narrow for its label.
    tiles: "lg:grid-cols-5",
  },
}

/** The tile's accent, taken from the same map the badges read. */
const TILE_TONE: Record<"neutral" | "accent" | "success" | "danger", string> = {
  neutral: "text-ash",
  accent: "text-ember",
  success: "text-acid",
  danger: "text-magenta",
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function OrderTable({ scope = "paid" }: { scope?: OrderScope }) {
  const copy = SCOPES[scope]
  const statuses = statusesIn(scope)
  const filters: Array<{ label: string; value: OrderStatus | "ALL" }> = [
    { label: scope === "paid" ? "All orders to fulfil" : "All orders", value: "ALL" },
    ...statuses.map((s) => ({ label: ORDER_STATUS_LABELS[s], value: s })),
  ]

  // Filter and search live in the URL, so a filtered view is shareable (§6).
  // The page number no longer does: paging happens in the table now, over the
  // window the server sent.
  const [state, setState] = useUrlState({ status: "ALL", q: "" })
  const [rawQuery, setRawQuery] = React.useState(state.q)
  const debounced = useDebounce(rawQuery, 350)

  React.useEffect(() => {
    if (debounced !== state.q) setState({ q: debounced })
  }, [debounced, state.q, setState])

  // A link or bookmark naming a status this board does not show falls back to all of it.
  const status: OrderStatus | "ALL" = statuses.includes(state.status as OrderStatus)
    ? (state.status as OrderStatus)
    : "ALL"
  const { data, isLoading, isError, error } = useOrders({ page: 1, scope, status, q: state.q })

  const columns: Column<OrderRow>[] = [
    {
      key: "number",
      header: "Order",
      value: (o) => o.number,
      // The row is not the link: a clickable row and a selection checkbox
      // fight over the same click.
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
        <StatusBadge status={o.status} label={statusLabelFor(o.status, o.paymentMethod)} />
      ),
    },
    {
      key: "payment",
      header: "Payment",
      value: (o) => PAYMENT_METHOD_SHORT[o.paymentMethod],
      cell: (o) => (
        <span className="text-ash font-mono text-[12px]">
          {PAYMENT_METHOD_SHORT[o.paymentMethod]}
        </span>
      ),
    },
    {
      key: "customer",
      header: "Customer",
      value: (o) => o.customer || o.email,
      cell: (o) => (
        <span className="block min-w-0">
          <span className="text-bone block truncate text-[14px]">{o.customer}</span>
          <span className="text-dim block truncate font-mono text-[11px]">{o.email}</span>
        </span>
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
      // Money is a string on the wire; as text "₹1,000" sorts below "₹2".
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
      // Sorts on the ISO string, which orders correctly.
      value: (o) => o.placedAt ?? o.createdAt,
      cell: (o) => (
        <span className="text-dim font-mono text-[11.5px]">
          {fmtDate(o.placedAt ?? o.createdAt)}
        </span>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        eyebrow={scope === "all" ? "Orders" : undefined}
        title={copy.title}
        description={copy.description}
      />

      {/* The board. Every status this page covers is here whether or not it
          has anything in it, and each tile is also the filter — the dropdown
          and these set the same thing, so whichever you reach for the other
          follows. */}
      <div className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3", copy.tiles)}>
        <BoardTile
          label={copy.all}
          value={data?.allCount ?? 0}
          empty={!data?.allCount}
          active={status === "ALL"}
          onClick={() => setState({ status: "ALL" })}
        />
        {statuses.map((s) => (
          <BoardTile
            key={s}
            label={ORDER_STATUS_LABELS[s]}
            value={data?.counts?.[s] ?? 0}
            empty={!data?.counts?.[s]}
            tone={TILE_TONE[ORDER_STATUS_COLORS[s]]}
            active={status === s}
            onClick={() => setState({ status: s })}
          />
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-[420px]">
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

        <Select
          label="Filter by status"
          value={status}
          onChange={(next) => setState({ status: next })}
          className="w-full sm:w-[260px]"
          options={filters.map((f) => ({
            value: f.value,
            label: f.label,
            hint:
              f.value === "ALL"
                ? (data?.allCount ?? 0)
                : (data?.counts?.[f.value as OrderStatus] ?? 0),
          }))}
        />
      </div>

      {isError ? (
        <EmptyState
          title="Could not load orders"
          description={error instanceof Error ? error.message : undefined}
        />
      ) : (
        <DataTable
          rows={data?.data ?? []}
          columns={columns}
          rowId={(o) => o.id}
          exportName={copy.exportName}
          loading={isLoading}
          total={data?.pagination?.total}
          empty="Nothing matches. Try a different status or clear the search."
          exportColumns={[
            { header: "Order", value: (o) => o.number },
            { header: "Status", value: (o) => o.status },
            { header: "Payment", value: (o) => PAYMENT_METHOD_SHORT[o.paymentMethod] },
            { header: "Customer", value: (o) => o.customer },
            { header: "Email", value: (o) => o.email },
            { header: "Phone", value: (o) => o.phone },
            { header: "City", value: (o) => o.city },
            { header: "Items", value: (o) => o.itemCount },
            { header: "Total", value: (o) => Number(o.total) },
            { header: "Placed", value: (o) => fmtDate(o.placedAt ?? o.createdAt) },
          ]}
        />
      )}
    </div>
  )
}
