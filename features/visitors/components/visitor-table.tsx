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
import { Select } from "@/components/ui/select"
import { DeviceIcon } from "@/features/visitors/components/device-icon"
import {
  useVisitors,
  type VisitorRow,
  type VisitorView,
} from "@/features/visitors/hooks/use-visitors"
import {
  ago,
  deviceLine,
  duration,
  placeLine,
  sourceLine,
  visitorName,
  when,
} from "@/features/visitors/lib/format"
import { useDebounce } from "@/hooks/use-debounce"
import { useUrlState } from "@/hooks/use-url-state"

const VIEWS: Array<{ id: VisitorView; label: string; tone: string }> = [
  { id: "all", label: "All visitors", tone: "text-bone" },
  { id: "known", label: "Accepted cookies", tone: "text-acid" },
  { id: "anonymous", label: "Anonymous", tone: "text-ash" },
  { id: "contact", label: "With contact details", tone: "text-acid" },
  { id: "cart", label: "Items in cart", tone: "text-ember" },
  { id: "bought", label: "Bought", tone: "text-acid" },
]

const PERIODS = [
  { value: "1", label: "Last 24 hours" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "0", label: "All time" },
]

// Stable, since useUrlState memoises on it.
const DEFAULTS = { view: "all", days: "30", q: "" }

/**
 * Everyone who has browsed the shop - a visitor who accepted cookies as one
 * row across all their visits, and everyone else one anonymous row per visit.
 */
export function VisitorTable() {
  const [state, setState] = useUrlState(DEFAULTS)
  const [rawQuery, setRawQuery] = React.useState(state.q)
  const debounced = useDebounce(rawQuery, 350)

  React.useEffect(() => {
    if (debounced !== state.q) setState({ q: debounced })
  }, [debounced, state.q, setState])

  const view = (VIEWS.some((v) => v.id === state.view) ? state.view : "all") as VisitorView
  const days = PERIODS.some((p) => p.value === state.days) ? state.days : "30"
  const { data, isLoading, isError, error } = useVisitors({ view, days, q: state.q })

  const columns: Column<VisitorRow>[] = [
    {
      key: "visitor",
      header: "Visitor",
      value: (v) => visitorName(v),
      cell: (v) => (
        <Link href={`/admin/customers/visitors/${v.id}`} className="group block min-w-0">
          <span className="text-bone group-hover:text-blaze flex items-center gap-2 text-[14px] transition-colors">
            <span className="truncate">{visitorName(v)}</span>
            {v.orders > 0 ? <Badge variant="acid">Bought</Badge> : null}
          </span>
          <span className="text-dim block truncate font-mono text-[11px]">
            {v.phone ?? (v.name && v.email ? v.email : v.anonymous ? "did not accept cookies" : "")}
          </span>
        </Link>
      ),
    },
    {
      key: "place",
      header: "Where",
      value: (v) => placeLine(v),
      cell: (v) => (
        <span className="block min-w-0">
          <span className="text-ash block truncate text-[13px]">{placeLine(v)}</span>
          {v.ip ? (
            <span className="text-dim block truncate font-mono text-[11px]">{v.ip}</span>
          ) : null}
        </span>
      ),
    },
    {
      key: "device",
      header: "Device",
      value: (v) => deviceLine(v),
      cell: (v) => (
        <span className="flex min-w-0 items-center gap-2">
          <DeviceIcon type={v.deviceType} className="text-dim size-4 shrink-0" />
          <span className="text-ash truncate text-[12.5px]">{deviceLine(v)}</span>
        </span>
      ),
    },
    {
      key: "source",
      header: "Came from",
      value: (v) => sourceLine(v),
      cell: (v) => (
        <span className="block min-w-0">
          <span className="text-ash block truncate text-[13px]">{sourceLine(v)}</span>
          {v.campaign ? (
            <span className="text-dim block truncate font-mono text-[11px]">{v.campaign}</span>
          ) : null}
        </span>
      ),
    },
    {
      key: "visits",
      header: "Visits",
      align: "right",
      value: (v) => v.visitCount,
      cell: (v) => <span className="text-bone font-mono text-[13px]">{v.visitCount}</span>,
    },
    {
      key: "pages",
      header: "Pages",
      align: "right",
      value: (v) => v.pageviews,
      cell: (v) => <span className="text-ash font-mono text-[13px]">{v.pageviews}</span>,
    },
    {
      key: "time",
      header: "Time on site",
      align: "right",
      value: (v) => v.engagedSeconds,
      cell: (v) => (
        <span className="text-ash font-mono text-[12.5px]">{duration(v.engagedSeconds)}</span>
      ),
    },
    {
      key: "cart",
      header: "In cart",
      align: "right",
      value: (v) => Number(v.cartValue),
      cell: (v) =>
        v.cartItems > 0 ? (
          <span className="text-ember font-mono text-[13px]">
            <Money value={v.cartValue} />
          </span>
        ) : (
          <span className="text-dim">-</span>
        ),
    },
    {
      key: "seen",
      header: "Last seen",
      align: "right",
      value: (v) => v.lastSeenAt,
      cell: (v) => (
        <span className="text-dim font-mono text-[11.5px]" title={when(v.lastSeenAt)}>
          {ago(v.lastSeenAt)}
        </span>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        eyebrow="Customers"
        title="Visitors"
        description="Everyone who has browsed the shop. A visitor who accepted cookies is one row across all their visits, with their IP address, device and anything typed at checkout. Everyone else is counted one visit at a time, anonymously. Staff signed in to the console are never counted."
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {VIEWS.map((v) => (
          <BoardTile
            key={v.id}
            label={v.label}
            value={data?.counts?.[v.id] ?? 0}
            empty={!data?.counts?.[v.id]}
            tone={v.tone}
            active={view === v.id}
            onClick={() => setState({ view: v.id })}
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
            placeholder="Name, email, phone, city, IP or source"
            aria-label="Search visitors"
            className="pl-11"
          />
        </div>
        <Select
          label="Period"
          value={days}
          onChange={(next) => setState({ days: next })}
          className="w-full sm:w-[220px]"
          options={PERIODS}
        />
      </div>

      {isError ? (
        <EmptyState
          title="Could not load visitors"
          description={error instanceof Error ? error.message : undefined}
        />
      ) : (
        <DataTable
          rows={data?.data ?? []}
          columns={columns}
          rowId={(v) => v.id}
          exportName="visitors"
          loading={isLoading}
          total={data?.pagination?.total}
          empty={
            state.q || view !== "all"
              ? "Nobody matches. Try another tile, a longer period, or clear the search."
              : "No visitors in this period yet. They appear as soon as someone opens the shop."
          }
          exportColumns={[
            { header: "Visitor", value: (v) => visitorName(v) },
            { header: "Cookies", value: (v) => (v.anonymous ? "Anonymous" : "Accepted") },
            { header: "Name", value: (v) => v.name ?? "" },
            { header: "Email", value: (v) => v.email ?? "" },
            { header: "Phone", value: (v) => v.phone ?? "" },
            { header: "IP address", value: (v) => v.ip ?? "" },
            { header: "City", value: (v) => v.city ?? "" },
            { header: "Region", value: (v) => v.region ?? "" },
            { header: "Country", value: (v) => v.country ?? "" },
            { header: "Device type", value: (v) => v.deviceType ?? "" },
            { header: "Device", value: (v) => v.deviceModel ?? "" },
            { header: "OS", value: (v) => v.os ?? "" },
            { header: "Browser", value: (v) => v.browser ?? "" },
            { header: "Source", value: (v) => v.source ?? "" },
            { header: "Medium", value: (v) => v.medium ?? "" },
            { header: "Campaign", value: (v) => v.campaign ?? "" },
            { header: "Referrer", value: (v) => v.referrer ?? "" },
            { header: "Landing page", value: (v) => v.landingPage ?? "" },
            { header: "Visits", value: (v) => v.visitCount },
            { header: "Pages", value: (v) => v.pageviews },
            { header: "Seconds on site", value: (v) => v.engagedSeconds },
            { header: "Cart value", value: (v) => Number(v.cartValue) },
            { header: "Paid orders", value: (v) => v.orders },
            { header: "Spent", value: (v) => Number(v.spent) },
            { header: "First seen", value: (v) => when(v.firstSeenAt) },
            { header: "Last seen", value: (v) => when(v.lastSeenAt) },
          ]}
        />
      )}
    </div>
  )
}
