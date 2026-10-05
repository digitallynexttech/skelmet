"use client"

import Link from "next/link"
import {
  AlertTriangle,
  ArrowRight,
  IndianRupee,
  LayoutDashboard,
  PackageCheck,
  ShoppingBag,
} from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { Money } from "@/components/shared/money"
import { PageHeader } from "@/components/shared/page-header"
import { StatTile } from "@/components/shared/stat-tile"
import { ToneBadge } from "@/components/shared/status-badge"
import { useDashboard } from "@/features/orders/hooks/use-orders"
import { FULFILMENT_STATES, PAYMENT_STATES } from "@/features/orders/order-progress"
import { cn } from "@/lib/utils"

export function AdminDashboard() {
  const { data, isLoading, isError, error } = useDashboard()

  return (
    <div className="flex flex-col gap-5">
      <PageHeader icon={LayoutDashboard} title="Dashboard" />

      {isError ? (
        <EmptyState
          title="Could not load the dashboard"
          description={error instanceof Error ? error.message : "Try again in a moment."}
        />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Orders today" icon={ShoppingBag} tone="text-ember">
          {isLoading ? "-" : (data?.todayCount ?? 0)}
        </StatTile>
        <StatTile
          label="Revenue, 7 days"
          hint="Excludes cancelled and refunded"
          icon={IndianRupee}
          tone="text-acid"
        >
          {isLoading ? "-" : <Money value={data?.weekRevenue ?? 0} />}
        </StatTile>
        <StatTile
          label="Awaiting fulfilment"
          hint="Paid, confirmed or packed"
          icon={PackageCheck}
          tone="text-violet"
        >
          {isLoading ? "-" : (data?.awaiting ?? 0)}
        </StatTile>
        <StatTile label="Low stock" hint="5 or fewer left" icon={AlertTriangle} tone="text-magenta">
          {isLoading ? "-" : (data?.lowStock.length ?? 0)}
        </StatTile>
      </div>

      {data && data.lowStock.length > 0 ? (
        <div className="border-magenta/25 bg-magenta/[0.04] rounded-md border px-5 py-4">
          <div className="mb-3 flex items-center gap-2.5">
            <AlertTriangle className="text-magenta size-4" strokeWidth={1.9} />
            <h2 className="text-bone text-[15px] font-semibold">Running low</h2>
          </div>
          <ul className="flex flex-wrap gap-2.5">
            {data.lowStock.map((v) => (
              <li
                key={v.sku}
                className="bg-void flex items-center gap-3 rounded-md border border-white/[0.09] px-4 py-2.5"
              >
                <span className="text-dim font-mono text-[11px] tracking-[0.1em]">{v.sku}</span>
                <span className="text-bone text-[13.5px] capitalize">{v.colourway}</span>
                <span
                  className={cn(
                    "font-mono text-[13px] font-bold",
                    v.stock === 0 ? "text-magenta" : "text-ember",
                  )}
                >
                  {v.stock} left
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="bg-carbon rounded-md border border-white/[0.09]">
        <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-3.5">
          <h2 className="text-bone text-[15px] font-semibold">Latest orders</h2>
          {/* The latest of every status, paid or not, so the full list it continues. */}
          <Link
            href="/admin/orders/all"
            className="text-ash hover:text-bone flex items-center gap-1.5 text-[13px] font-semibold transition-colors"
          >
            All orders
            <ArrowRight className="size-4" strokeWidth={2.2} />
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-2 p-5">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-md bg-white/5" />
            ))}
          </div>
        ) : data && data.recent.length > 0 ? (
          <ul className="divide-y divide-white/[0.06]">
            {data.recent.map((order) => (
              <li key={order.id}>
                <Link
                  href={`/admin/orders/${order.id}`}
                  className="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3.5 transition-colors hover:bg-white/[0.03]"
                >
                  <span className="text-bone font-mono text-[13px]">{order.number}</span>
                  <span className="text-ash min-w-0 flex-1 truncate text-[13.5px]">
                    {order.customer} · {order.location}
                  </span>
                  {/* The same two statuses the order list leads with. */}
                  <ToneBadge tone={PAYMENT_STATES[order.payment].tone}>
                    {PAYMENT_STATES[order.payment].label}
                  </ToneBadge>
                  <ToneBadge tone={FULFILMENT_STATES[order.fulfilment].tone}>
                    {FULFILMENT_STATES[order.fulfilment].label}
                  </ToneBadge>
                  <span className="text-bone font-mono text-[13.5px]">
                    <Money value={order.total} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            className="m-5 border-0 bg-transparent py-10"
            title="No orders yet"
            description="They will appear here the moment the first one is placed."
          />
        )}
      </div>
    </div>
  )
}
