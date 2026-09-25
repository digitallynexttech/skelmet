"use client"

import * as React from "react"

import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { PaymentSettings } from "@/features/settings/components/payment-settings"
import { ShippingChargeSettings } from "@/features/settings/components/shipping-charge-settings"
import { ShiprocketSettings } from "@/features/settings/components/shiprocket-settings"
import { StaffSettings } from "@/features/settings/components/staff-settings"
import { useRuntimeSettings } from "@/features/settings/hooks/use-runtime-settings"
import { useConfirm } from "@/hooks/use-confirm"
import { useUrlState } from "@/hooks/use-url-state"
import { cn } from "@/lib/utils"

const TABS = [
  { id: "payments", label: "Payments" },
  { id: "shiprocket", label: "Shiprocket" },
  { id: "shipping", label: "Shipping charge" },
  { id: "team", label: "Team" },
] as const
type TabId = (typeof TABS)[number]["id"]

// Stable, since useUrlState memoises on it.
const DEFAULTS = { tab: "payments" }

function Tabs({ active, onChange }: { active: TabId; onChange: (tab: TabId) => void }) {
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
      aria-label="Settings"
      className="flex gap-1 overflow-x-auto border-b border-white/[0.09]"
    >
      {TABS.map((tab, i) => {
        const selected = tab.id === active
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
              "-mb-px min-h-11 shrink-0 border-b-2 px-4 text-[14px] whitespace-nowrap transition-colors",
              selected
                ? "border-blaze text-bone font-semibold"
                : "text-ash hover:text-bone border-transparent",
            )}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

export function SettingsView() {
  const [state, setState] = useUrlState(DEFAULTS)
  const active: TabId = TABS.some((t) => t.id === state.tab) ? (state.tab as TabId) : "payments"
  const { data, isLoading, isError, error } = useRuntimeSettings()
  const { ask, dialog } = useConfirm()

  let panel: React.ReactNode
  if (active === "team") {
    panel = <StaffSettings embedded />
  } else if (isLoading) {
    panel = (
      <div className="flex flex-col gap-5">
        <div className="rounded-card h-56 animate-pulse bg-white/5" />
        <div className="rounded-card h-72 animate-pulse bg-white/5" />
      </div>
    )
  } else if (isError || !data) {
    panel = (
      <EmptyState
        title="Could not load settings"
        description={error instanceof Error ? error.message : "Try again in a moment."}
      />
    )
  } else if (active === "payments") {
    panel = <PaymentSettings payment={data.payment} canWrite={data.canWrite} ask={ask} />
  } else if (active === "shiprocket") {
    panel = <ShiprocketSettings shiprocket={data.shiprocket} canWrite={data.canWrite} ask={ask} />
  } else {
    panel = <ShippingChargeSettings shipping={data.shipping} canWrite={data.canWrite} ask={ask} />
  }

  return (
    <div className="flex flex-col gap-7">
      {dialog}
      <PageHeader
        eyebrow="Console"
        title="Settings"
        description="Payment keys, the Shiprocket login and the shipping charge. A change here takes effect straight away, without a deploy, and every save is logged."
      />

      <Tabs active={active} onChange={(tab) => setState({ tab })} />

      <div id={`panel-${active}`} role="tabpanel" aria-labelledby={`tab-${active}`}>
        {data && !data.canWrite && active !== "team" ? (
          <p className="text-ash mb-5 text-[13.5px]">
            You can see these settings but not change them.
          </p>
        ) : null}
        {panel}
      </div>
    </div>
  )
}
