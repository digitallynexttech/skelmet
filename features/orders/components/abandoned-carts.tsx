"use client"

import * as React from "react"
import Link from "next/link"
import { Search } from "lucide-react"

import { BoardTile } from "@/components/shared/board-tile"
import { EmptyState } from "@/components/shared/empty-state"
import { Money } from "@/components/shared/money"
import { PageHeader } from "@/components/shared/page-header"
import { Badge } from "@/components/ui/badge"
import { DataTable, type Column } from "@/components/ui/data-table"
import { Input } from "@/components/ui/input"
import { useUnpaidOrders, type UnpaidOrderRow } from "@/features/orders/hooks/use-orders"
import { ContactActions } from "@/features/visitors/components/contact-actions"
import { LeftCartsTable } from "@/features/visitors/components/left-carts-table"
import { useLeftCarts } from "@/features/visitors/hooks/use-visitors"
import { when } from "@/features/visitors/lib/format"
import { useUrlState } from "@/hooks/use-url-state"
import { cn } from "@/lib/utils"

const TABS = [
  { id: "unpaid", label: "Payment not done" },
  { id: "carts", label: "Left in cart" },
] as const
type TabId = (typeof TABS)[number]["id"]

type Show = "all" | "lost" | "recovered" | "open"

// Stable, since useUrlState memoises on it.
const DEFAULTS = { tab: "unpaid", show: "all" }

const STATE: Record<
  UnpaidOrderRow["state"],
  { label: string; variant: "ember" | "magenta" | "muted" }
> = {
  open: { label: "Awaiting payment", variant: "ember" },
  expired: { label: "Payment not done", variant: "magenta" },
  cancelled: { label: "Cancelled by staff", variant: "muted" },
}

const PAYMENT: Record<UnpaidOrderRow["payment"], string> = {
  failed: "Payment tried and failed",
  closed: "Payment window closed",
  none: "Payment never opened",
}

const itemsText = (o: UnpaidOrderRow) => o.items.map((i) => `${i.qty} × ${i.name}`).join(", ")

function message(o: UnpaidOrderRow): string {
  return `Hi ${o.firstName || "there"}, this is SKELMET. Your order ${o.number} (${itemsText(o)}) wasn't paid for, so it didn't go through. Want a hand finishing it?`
}

function Tabs({
  active,
  counts,
  onChange,
}: {
  active: TabId
  counts: Partial<Record<TabId, number>>
  onChange: (tab: TabId) => void
}) {
  const refs = React.useRef<Array<HTMLButtonElement | null>>([])

  // Arrow keys move between tabs, as a tab list is expected to.
  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0
    if (!step) return
    e.preventDefault()
    const next = (index + step + TABS.length) % TABS.length
    refs.current[next]?.focus()
    onChange(TABS[next]!.id)
  }

  return (
    <div
      role="tablist"
      aria-label="Abandoned carts"
      className="flex gap-1 overflow-x-auto border-b border-white/[0.09]"
    >
      {TABS.map((tab, i) => {
        const selected = tab.id === active
        const count = counts[tab.id]
        return (
          <button
            key={tab.id}
            ref={(el) => {
              refs.current[i] = el
            }}
            id={`tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`panel-${tab.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              "-mb-px flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-4 text-[14px] whitespace-nowrap transition-colors",
              selected
                ? "border-blaze text-bone font-semibold"
                : "text-ash hover:text-bone border-transparent",
            )}
          >
            {tab.label}
            {typeof count === "number" ? (
              <span className="text-dim font-mono text-[11px] font-normal">{count}</span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

function UnpaidOrders({ show, onShow }: { show: Show; onShow: (show: Show) => void }) {
  const { data, isLoading, isError, error } = useUnpaidOrders()
  const [query, setQuery] = React.useState("")

  const rows = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    return (data?.data ?? []).filter((o) => {
      if (show === "lost" && (o.recoveredBy || o.state === "open")) return false
      if (show === "recovered" && !o.recoveredBy) return false
      if (show === "open" && o.state !== "open") return false
      if (!q) return true
      return [o.number, o.customer, o.email, o.phone, o.city].some((s) =>
        s.toLowerCase().includes(q),
      )
    })
  }, [data, show, query])

  const summary = data?.summary
  const lost = summary?.lost ?? 0

  const columns: Column<UnpaidOrderRow>[] = [
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
      key: "state",
      header: "Status",
      value: (o) => STATE[o.state].label,
      cell: (o) => (
        <span className="flex flex-col items-start gap-1">
          <Badge variant={STATE[o.state].variant}>{STATE[o.state].label}</Badge>
          <span className="text-dim text-[11.5px]">{PAYMENT[o.payment]}</span>
        </span>
      ),
    },
    {
      key: "customer",
      header: "Customer",
      value: (o) => o.customer,
      cell: (o) => (
        <span className="block min-w-0">
          <span className="text-bone block truncate text-[14px]">{o.customer}</span>
          <span className="text-dim block truncate font-mono text-[11px]">{o.email}</span>
          <span className="text-dim block truncate font-mono text-[11px]">{o.phone}</span>
        </span>
      ),
    },
    {
      key: "items",
      header: "Wanted",
      value: (o) => itemsText(o),
      cell: (o) => (
        <span className="block min-w-[160px]">
          {o.items.map((i, n) => (
            <span key={n} className="text-ash block text-[13px]">
              {i.qty} × {i.name}
            </span>
          ))}
          {o.city ? <span className="text-dim block text-[11.5px]">{o.city}</span> : null}
        </span>
      ),
    },
    {
      key: "total",
      header: "Value",
      align: "right",
      value: (o) => Number(o.total),
      cell: (o) => (
        <span className="text-bone font-mono text-[13.5px]">
          <Money value={o.total} />
        </span>
      ),
    },
    {
      key: "recovered",
      header: "Came back?",
      value: (o) => o.recoveredBy?.number ?? "",
      cell: (o) =>
        o.recoveredBy ? (
          <Link
            href={`/admin/orders/${o.recoveredBy.id}`}
            className="flex flex-col items-start gap-1"
            title="Paid on a later order"
          >
            <Badge variant="acid">Recovered</Badge>
            <span className="text-ash hover:text-blaze font-mono text-[11px] transition-colors">
              {o.recoveredBy.number}
            </span>
          </Link>
        ) : (
          <span className="text-dim text-[12.5px]">Not yet</span>
        ),
    },
    {
      key: "placed",
      header: "Placed",
      align: "right",
      value: (o) => o.createdAt,
      cell: (o) => <span className="text-dim font-mono text-[11.5px]">{when(o.createdAt)}</span>,
    },
    {
      key: "contact",
      header: "Follow up",
      align: "right",
      cell: (o) =>
        o.recoveredBy ? (
          <span className="text-dim text-[12px]">Already paid</span>
        ) : (
          <ContactActions
            phone={o.phone}
            email={o.email}
            message={message(o)}
            subject={`Your SKELMET order ${o.number}`}
          />
        ),
    },
  ]

  if (isError) {
    return (
      <EmptyState
        title="Could not load unpaid orders"
        description={error instanceof Error ? error.message : undefined}
      />
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <BoardTile
          label="All unpaid"
          value={data?.data.length ?? 0}
          empty={!data?.data.length}
          active={show === "all"}
          onClick={() => onShow("all")}
        />
        <BoardTile
          label="Lost - not back yet"
          value={lost}
          empty={!lost}
          tone="text-magenta"
          active={show === "lost"}
          onClick={() => onShow("lost")}
        />
        <BoardTile
          label="Recovered - paid later"
          value={summary?.recovered ?? 0}
          empty={!summary?.recovered}
          tone="text-acid"
          active={show === "recovered"}
          onClick={() => onShow("recovered")}
        />
        <BoardTile
          label="Still awaiting payment"
          value={summary?.open ?? 0}
          empty={!summary?.open}
          tone="text-ember"
          active={show === "open"}
          onClick={() => onShow("open")}
        />
        <BoardTile
          label="Value not recovered"
          value={<Money value={summary?.lostValue ?? 0} />}
          empty={!Number(summary?.lostValue)}
          tone="text-magenta"
        />
      </div>

      <div className="relative w-full sm:max-w-[420px]">
        <Search
          className="text-dim pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2"
          strokeWidth={1.9}
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="SKM-2026-4F2K, name, email or phone"
          aria-label="Search unpaid orders"
          className="pl-11"
        />
      </div>

      <DataTable
        rows={rows}
        columns={columns}
        rowId={(o) => o.id}
        exportName="unpaid-orders"
        loading={isLoading}
        empty={
          query || show !== "all"
            ? "Nothing matches. Try another tile or clear the search."
            : "No unpaid orders. Every order placed so far was paid for."
        }
        exportColumns={[
          { header: "Order", value: (o) => o.number },
          { header: "Status", value: (o) => STATE[o.state].label },
          { header: "Payment", value: (o) => PAYMENT[o.payment] },
          { header: "Customer", value: (o) => o.customer },
          { header: "Email", value: (o) => o.email },
          { header: "Phone", value: (o) => o.phone },
          { header: "City", value: (o) => o.city },
          { header: "Wanted", value: (o) => itemsText(o) },
          { header: "Value", value: (o) => Number(o.total) },
          { header: "Recovered by", value: (o) => o.recoveredBy?.number ?? "" },
          { header: "Source", value: (o) => o.source ?? "" },
          { header: "Placed", value: (o) => when(o.createdAt) },
        ]}
      />
    </div>
  )
}

/**
 * Everyone who got close and did not pay, in the two places they stopped:
 * at the payment, with an order already written, or before it, with only a
 * cart.
 */
export function AbandonedCarts() {
  const [state, setState] = useUrlState(DEFAULTS)
  const active: TabId = TABS.some((t) => t.id === state.tab) ? (state.tab as TabId) : "unpaid"
  const show: Show = (["all", "lost", "recovered", "open"] as const).includes(state.show as Show)
    ? (state.show as Show)
    : "all"

  // For the tab counts; the panels read the same cached queries.
  const unpaid = useUnpaidOrders()
  const carts = useLeftCarts()

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        eyebrow="Orders"
        title="Abandoned carts"
        description="People who got as far as paying, or as far as the cart, and stopped. Unpaid orders are cancelled after an hour to put their stock back on sale; All orders lists them as Cancelled."
      />

      <Tabs
        active={active}
        counts={{ unpaid: unpaid.data?.data.length, carts: carts.data?.summary.count }}
        onChange={(tab) => setState({ tab, show: "all" })}
      />

      <div id={`panel-${active}`} role="tabpanel" aria-labelledby={`tab-${active}`}>
        {active === "unpaid" ? (
          <UnpaidOrders show={show} onShow={(next) => setState({ show: next })} />
        ) : (
          <LeftCartsTable />
        )}
      </div>
    </div>
  )
}
