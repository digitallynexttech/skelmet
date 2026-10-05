"use client"

import Link from "next/link"
import { AlertTriangle, ArrowRight, IndianRupee, PackageCheck, ShoppingBag } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { Money } from "@/components/shared/money"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { statusLabelFor } from "@/features/checkout/payment-options"
import { useDashboard } from "@/features/orders/hooks/use-orders"
import { cn } from "@/lib/utils"

function Tile({
  label,
  value,
  hint,
  Icon,
  tone,
}: {
  label: string
  value: React.ReactNode
  hint?: string
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  tone: string
}) {
  return (
    <div className="bg-carbon rounded-md border border-white/[0.09] p-6">
      <div className="mb-5 flex items-center justify-between">
        <span className="text-dim font-mono text-[10px] tracking-[0.16em] uppercase">{label}</span>
        <Icon className={cn("size-[18px]", tone)} strokeWidth={1.8} />
      </div>
      <div className="font-display text-bone text-[38px] leading-[1.04]">{value}</div>
      {hint ? <div className="text-dim mt-1.5 text-[12.5px]">{hint}</div> : null}
    </div>
  )
}

export function AdminDashboard() {
  const { data, isLoading, isError, error } = useDashboard()

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Dashboard"
        description="Today at a glance: orders that need packing, what came in this week, and anything running low."
      />

      {isError ? (
        <EmptyState
          title="Could not load the dashboard"
          description={error instanceof Error ? error.message : "Try again in a moment."}
        />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile
          label="Orders today"
          value={isLoading ? "-" : (data?.todayCount ?? 0)}
          Icon={ShoppingBag}
          tone="text-ember"
        />
        <Tile
          label="Revenue, 7 days"
          value={isLoading ? "-" : <Money value={data?.weekRevenue ?? 0} />}
          hint="Excludes cancelled and refunded"
          Icon={IndianRupee}
          tone="text-acid"
        />
        <Tile
          label="Awaiting fulfilment"
          value={isLoading ? "-" : (data?.awaiting ?? 0)}
          hint="Paid, confirmed or packed"
          Icon={PackageCheck}
          tone="text-violet"
        />
        <Tile
          label="Low stock"
          value={isLoading ? "-" : (data?.lowStock.length ?? 0)}
          hint="5 or fewer left"
          Icon={AlertTriangle}
          tone="text-magenta"
        />
      </div>

      {data && data.lowStock.length > 0 ? (
        <div className="border-magenta/25 bg-magenta/[0.04] rounded-md border p-6">
          <div className="mb-4 flex items-center gap-2.5">
            <AlertTriangle className="text-magenta size-[18px]" strokeWidth={1.8} />
            <h2 className="font-display text-bone text-[20px] uppercase">Running low</h2>
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
        <div className="flex items-center justify-between border-b border-white/[0.07] px-6 py-5">
          <h2 className="font-display text-bone text-[22px] uppercase">Latest orders</h2>
          {/* The latest of every status, paid or not, so the full list it continues. */}
          <Link
            href="/admin/orders/all"
            className="text-ember hover:text-flare flex items-center gap-2 text-[13px] font-semibold"
          >
            All orders
            <ArrowRight className="size-4" strokeWidth={2.2} />
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-2 p-6">
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
                  className="flex flex-wrap items-center gap-x-5 gap-y-2 px-6 py-4 transition-colors hover:bg-white/[0.03]"
                >
                  <span className="text-bone font-mono text-[13px]">{order.number}</span>
                  <StatusBadge
                    status={order.status}
                    label={statusLabelFor(order.status, order.paymentMethod)}
                  />
                  <span className="text-ash min-w-0 flex-1 truncate text-[13.5px]">
                    {order.customer} · {order.location}
                  </span>
                  <span className="text-bone font-mono text-[13.5px]">
                    <Money value={order.total} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            className="m-6 border-0 bg-transparent py-10"
            title="No orders yet"
            description="They will appear here the moment the first one is placed."
          />
        )}
      </div>
    </div>
  )
}
