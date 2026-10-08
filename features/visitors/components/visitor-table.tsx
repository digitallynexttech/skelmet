"use client"

import * as React from "react"
import Link from "next/link"
import { Users } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { Money } from "@/components/shared/money"
import { PageHeader } from "@/components/shared/page-header"
import { Badge } from "@/components/ui/badge"
import { DataTable, type Column, type DataTableHandle } from "@/components/ui/data-table"
import { ExportMenu } from "@/components/ui/export-menu"
import { TableSearch } from "@/components/ui/table-search"
import { ViewMenu } from "@/components/ui/view-menu"
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
import { regionOf } from "@/lib/india"

const VIEWS: Array<{ id: VisitorView; label: string }> = [
  { id: "all", label: "All" },
  { id: "known", label: "Accepted cookies" },
  // Each anonymous row is one visit, not one person.
  { id: "anonymous", label: "Anonymous visits" },
  { id: "contact", label: "With contact details" },
  { id: "cart", label: "Items in cart" },
  { id: "bought", label: "Bought" },
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
  const table = React.useRef<DataTableHandle<VisitorRow>>(null)

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
    <div className="flex flex-col gap-5">
      <PageHeader
        icon={Users}
        title="Visitors"
        parent={{ label: "Customers", href: "/admin/customers" }}
        actions={<ExportMenu table={table} noun={["visitor", "visitors"]} />}
      />

      {isError ? (
        <EmptyState
          title="Could not load visitors"
          description={error instanceof Error ? error.message : undefined}
        />
      ) : (
        <DataTable
          handle={table}
          rows={data?.data ?? []}
          columns={columns}
          rowId={(v) => v.id}
          exportName="visitors"
          exportButtons={false}
          pageKey={`${view}|${days}|${state.q}`}
          bar={
            <div className="flex items-center gap-2">
              <ViewMenu
                value={view}
                onChange={(v) => setState({ view: v })}
                options={VIEWS.map((v) => ({
                  value: v.id,
                  label: v.label,
                  count: data?.counts?.[v.id],
                }))}
              />
              <TableSearch
                value={rawQuery}
                onChange={setRawQuery}
                placeholder="Name, email, phone, city or IP"
                label="Search visitors by name, email, phone, city, IP address or source"
              />
            </div>
          }
          // On the right, so view and search keep the first row on a phone.
          barEnd={
            <ViewMenu
              label="Period"
              value={days}
              onChange={(next) => setState({ days: next })}
              options={PERIODS}
            />
          }
          loading={isLoading}
          total={data?.pagination?.total}
          empty={
            state.q || view !== "all"
              ? "Nobody matches. Try another view, a longer period, or clear the search."
              : "No visitors in this period yet. They appear as soon as someone opens the shop. Staff signed in to the admin are never counted."
          }
          exportColumns={[
            { header: "Visitor", value: (v) => visitorName(v) },
            { header: "Cookies", value: (v) => (v.anonymous ? "Anonymous" : "Accepted") },
            { header: "Name", value: (v) => v.name ?? "" },
            { header: "Email", value: (v) => v.email ?? "" },
            { header: "Phone", value: (v) => v.phone ?? "" },
            { header: "IP address", value: (v) => v.ip ?? "" },
            { header: "City", value: (v) => v.city ?? "" },
            { header: "District", value: (v) => v.district ?? "" },
            { header: "State", value: (v) => v.region ?? "" },
            { header: "Region", value: (v) => regionOf(v.region) ?? "" },
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
