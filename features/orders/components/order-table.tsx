"use client"

import * as React from "react"
import Link from "next/link"
import { ChevronDown, Search } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { Money } from "@/components/shared/money"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { DataTable, type Column } from "@/components/ui/data-table"
import { Input } from "@/components/ui/input"
import { useOrders, type OrderRow } from "@/features/orders/hooks/use-orders"
import {
  ORDER_STATUS_COLORS,
  ORDER_STATUS_LABELS,
  ORDER_STATUSES,
  type OrderStatus,
} from "@/lib/constants"
import { useDebounce } from "@/hooks/use-debounce"
import { useUrlState } from "@/hooks/use-url-state"
import { cn } from "@/lib/utils"

const FILTERS: Array<{ label: string; value: OrderStatus | "ALL" }> = [
  { label: "All orders", value: "ALL" },
  ...ORDER_STATUSES.map((s) => ({ label: ORDER_STATUS_LABELS[s], value: s as OrderStatus })),
]

/** The tile's accent, taken from the same map the badges read. */
const TILE_TONE: Record<"neutral" | "accent" | "success" | "danger", string> = {
  neutral: "text-ash",
  accent: "text-ember",
  success: "text-acid",
  danger: "text-magenta",
}

function StatusTile({
  label,
  count,
  tone,
  active,
  onClick,
}: {
  label: string
  count: number
  tone: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-md border px-4 py-3.5 text-left transition-colors",
        active
          ? "border-blaze/60 bg-blaze/[0.07]"
          : "bg-carbon border-white/[0.09] hover:border-white/25",
        // A status with nothing in it stays on the board but steps back, so
        // the eye lands on the queues that actually need working.
        count === 0 && !active && "opacity-45",
      )}
    >
      {/* Two lines' worth of room whether or not the label needs it: only
          "Awaiting payment" wraps, and without this its number sat lower
          than the eight beside it. */}
      <div className="text-dim mb-2 flex min-h-[2.4em] items-start font-mono text-[9.5px] leading-[1.2] tracking-[0.14em] uppercase">
        {label}
      </div>
      <div className={cn("font-display text-[26px] leading-none", count > 0 ? tone : "text-dim")}>
        {count}
      </div>
    </button>
  )
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function OrderTable() {
  // Filter and search live in the URL, so a filtered view is shareable (§6).
  // The page number no longer does: paging happens in the table now, over the
  // window the server sent.
  const [state, setState] = useUrlState({ status: "ALL", q: "" })
  const [rawQuery, setRawQuery] = React.useState(state.q)
  const debounced = useDebounce(rawQuery, 350)

  React.useEffect(() => {
    if (debounced !== state.q) setState({ q: debounced })
  }, [debounced, state.q, setState])

  const status = state.status as OrderStatus | "ALL"
  const { data, isLoading, isError, error } = useOrders({ page: 1, status, q: state.q })

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
      cell: (o) => <StatusBadge status={o.status} />,
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
        eyebrow="Console"
        title="Orders"
        description="Every order, newest first. Search by order number, email or phone."
      />

      {/* The board. Every status is here whether or not it has anything in
          it, and each tile is also the filter — the dropdown and these set
          the same thing, so whichever you reach for the other follows. */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9">
        <StatusTile
          label="All"
          count={data?.allCount ?? 0}
          tone="text-bone"
          active={status === "ALL"}
          onClick={() => setState({ status: "ALL" })}
        />
        {ORDER_STATUSES.map((s) => (
          <StatusTile
            key={s}
            label={ORDER_STATUS_LABELS[s]}
            count={data?.counts?.[s] ?? 0}
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

        <div className="relative w-full sm:w-[220px]">
          <select
            value={status}
            onChange={(e) => setState({ status: e.target.value as OrderStatus | "ALL" })}
            aria-label="Filter by status"
            className="rounded-field bg-void text-bone focus:border-blaze focus:ring-blaze/[0.16] h-[52px] w-full appearance-none border border-white/[0.14] pr-10 pl-4 text-[14px] outline-none transition-colors focus:ring-[3px]"
          >
            {FILTERS.map((f) => (
              <option key={f.value} value={f.value} className="bg-carbon">
                {f.label}
                {f.value === "ALL"
                  ? ` (${data?.allCount ?? 0})`
                  : ` (${data?.counts?.[f.value as OrderStatus] ?? 0})`}
              </option>
            ))}
          </select>
          <ChevronDown
            className="text-dim pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2"
            strokeWidth={2}
          />
        </div>
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
          exportName="orders"
          loading={isLoading}
          total={data?.pagination?.total}
          empty="Nothing matches. Try a different status or clear the search."
          exportColumns={[
            { header: "Order", value: (o) => o.number },
            { header: "Status", value: (o) => o.status },
            { header: "Payment", value: (o) => o.paymentMethod },
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
