"use client"

import * as React from "react"
import { Check, X } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { Money } from "@/components/shared/money"
import { PageHeader } from "@/components/shared/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  useReferralActions,
  useReferrals,
  type ReferralStatus,
} from "@/features/referrals/hooks/use-referrals"
import { useDebounce } from "@/hooks/use-debounce"

const FILTERS: Array<{ value: string; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "SENT", label: "Sent" },
  { value: "OPENED", label: "Opened" },
  { value: "ORDERED", label: "Ordered" },
  { value: "SHIPPING", label: "Shipping" },
  { value: "PAID", label: "Paid" },
  { value: "VOID", label: "Void" },
]

const TONE: Record<ReferralStatus, "muted" | "violet" | "ember" | "acid" | "outline"> = {
  SENT: "muted",
  OPENED: "violet",
  ORDERED: "ember",
  SHIPPING: "ember",
  PAID: "acid",
  VOID: "outline",
}

export function ReferralTable() {
  const [page, setPage] = React.useState(1)
  const [status, setStatus] = React.useState("ALL")
  const [search, setSearch] = React.useState("")
  const q = useDebounce(search, 300)

  const { data, isLoading, isError, error } = useReferrals({ page, status, q })
  const { approve, voidReferral } = useReferralActions()
  const busy = approve.isPending || voidReferral.isPending

  const rows = data?.data ?? []
  const pages = data?.pagination.totalPages ?? 1

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        eyebrow="Growth"
        title="Referrals"
        description="Approving a referral credits the referrer's balance. It cannot be undone, so check the order actually shipped first."
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => {
                setStatus(f.value)
                setPage(1)
              }}
              className={
                status === f.value
                  ? "rounded-full bg-blaze px-4 py-2 text-[12.5px] font-semibold text-void"
                  : "rounded-full border border-white/[0.14] px-4 py-2 text-[12.5px] text-ash transition-colors hover:border-white/30 hover:text-bone"
              }
            >
              {f.label}
            </button>
          ))}
        </div>

        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
          placeholder="Search by email"
          aria-label="Search referrals"
          className="h-11 sm:w-64"
        />
      </div>

      {isLoading ? (
        <div className="h-80 animate-pulse rounded-card bg-white/5" />
      ) : isError ? (
        <EmptyState
          title="Could not load referrals"
          description={error instanceof Error ? error.message : "Try again in a moment."}
        />
      ) : rows.length === 0 ? (
        <EmptyState title="Nothing here" description="No referrals match that filter." />
      ) : (
        <div className="overflow-x-auto rounded-card border border-white/[0.09] bg-carbon">
          <table className="w-full min-w-[820px]">
            <thead>
              <tr className="border-b border-white/[0.07] text-left font-mono text-[10px] tracking-[0.16em] text-dim uppercase">
                <th className="px-6 py-4 font-normal">Referrer</th>
                <th className="px-6 py-4 font-normal">Invited</th>
                <th className="px-6 py-4 font-normal">Status</th>
                <th className="px-6 py-4 font-normal">Reward</th>
                <th className="px-6 py-4 font-normal">Balance</th>
                <th className="px-6 py-4 font-normal">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-6 py-4">
                    <span className="block text-[14px] text-bone">{r.referrer.name ?? "Rider"}</span>
                    <span className="block font-mono text-[11.5px] text-dim">
                      {r.referrer.email}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono text-[12.5px] text-ash">{r.refereeEmail}</td>
                  <td className="px-6 py-4">
                    <Badge variant={TONE[r.status]}>{r.status}</Badge>
                  </td>
                  <td className="px-6 py-4">
                    <Money value={r.rewardAmount} className="font-mono text-[14px] text-bone" />
                  </td>
                  <td className="px-6 py-4">
                    <Money value={r.referrer.balance} className="font-mono text-[13px] text-ash" />
                  </td>
                  <td className="px-6 py-4">
                    {r.status === "PAID" || r.status === "VOID" ? (
                      <span className="font-mono text-[11.5px] text-dim">
                        {r.creditedAt
                          ? new Date(r.creditedAt).toLocaleDateString("en-IN")
                          : "closed"}
                      </span>
                    ) : (
                      <div className="flex gap-2">
                        <Button
                          variant="primary"
                          size="sm"
                          className="px-3"
                          disabled={busy}
                          onClick={() => approve.mutate(r.id)}
                        >
                          <Check className="size-3.5" strokeWidth={2.4} />
                          Credit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="px-3"
                          aria-label={`Void referral to ${r.refereeEmail}`}
                          disabled={busy}
                          onClick={() => voidReferral.mutate(r.id)}
                        >
                          <X className="size-3.5" strokeWidth={2.4} />
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 ? (
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="font-mono text-[12px] text-dim">
            Page {page} of {pages}
          </span>
          <Button
            variant="ghost"
            size="sm"
            disabled={page >= pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      ) : null}
    </div>
  )
}
