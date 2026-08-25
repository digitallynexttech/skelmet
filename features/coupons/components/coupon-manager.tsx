"use client"

import * as React from "react"
import { Percent, Plus, Search, Ticket, X } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { Money } from "@/components/shared/money"
import { PageHeader } from "@/components/shared/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field, Input } from "@/components/ui/input"
import { useCouponMutations, useCoupons } from "@/features/coupons/hooks/use-coupons"
import { useDebounce } from "@/hooks/use-debounce"
import { useUrlState } from "@/hooks/use-url-state"
import { cn } from "@/lib/utils"

const STATE_TONE = {
  ACTIVE: "acid",
  EXPIRED: "muted",
  EXHAUSTED: "ember",
} as const

function CreateForm({ onDone }: { onDone: () => void }) {
  const { create } = useCouponMutations()
  const [kind, setKind] = React.useState<"PERCENT" | "FLAT">("FLAT")
  const [error, setError] = React.useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    const form = new FormData(event.currentTarget)

    const expiresRaw = String(form.get("expiresAt") ?? "").trim()
    const maxUsesRaw = String(form.get("maxUses") ?? "").trim()

    try {
      await create.mutateAsync({
        code: String(form.get("code") ?? "").trim().toUpperCase(),
        kind,
        value: Number(form.get("value")),
        minSubtotal: Number(form.get("minSubtotal") || 0),
        maxUses: maxUsesRaw ? Number(maxUsesRaw) : null,
        expiresAt: expiresRaw ? new Date(expiresRaw).toISOString() : null,
      })
      onDone()
    } catch {
      setError("Check the fields and try again.")
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-card border border-blaze/30 bg-[linear-gradient(160deg,rgb(255_90_31_/_0.06),transparent_50%)] bg-carbon p-6"
    >
      <div className="mb-5 flex items-center justify-between">
        <h2 className="font-display text-[22px] text-bone uppercase">New discount code</h2>
        <button type="button" onClick={onDone} aria-label="Close" className="text-dim hover:text-bone">
          <X className="size-5" strokeWidth={2} />
        </button>
      </div>

      <div className="mb-4 flex flex-col gap-2.5">
        <span className="font-mono text-[10.5px] tracking-[0.16em] text-dim uppercase">Type</span>
        <div className="flex gap-2.5">
          {(["FLAT", "PERCENT"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={cn(
                "flex min-h-11 items-center gap-2 rounded-full border px-5 text-[13.5px] transition-colors",
                kind === k
                  ? "border-blaze bg-blaze/12 font-semibold text-bone"
                  : "border-white/[0.14] text-ash hover:border-white/30",
              )}
            >
              {k === "FLAT" ? <Ticket className="size-4" /> : <Percent className="size-4" />}
              {k === "FLAT" ? "Flat ₹ off" : "Percent off"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Code">
          <Input name="code" required placeholder="SKULL250" className="font-mono uppercase" />
        </Field>
        <Field label={kind === "FLAT" ? "Amount off (₹)" : "Percent off"}>
          <Input name="value" type="number" min="1" step="1" required placeholder={kind === "FLAT" ? "250" : "10"} />
        </Field>
        <Field label="Minimum subtotal (₹)">
          <Input name="minSubtotal" type="number" min="0" step="1" defaultValue="0" />
        </Field>
        <Field label="Max uses (blank = unlimited)">
          <Input name="maxUses" type="number" min="1" step="1" placeholder="100" />
        </Field>
        <Field label="Expires (blank = never)" className="sm:col-span-2">
          <Input name="expiresAt" type="date" />
        </Field>
      </div>

      {error ? <p className="mt-4 text-[13.5px] text-magenta">{error}</p> : null}

      <div className="mt-6 flex gap-2.5">
        <Button type="submit" variant="primary" size="md" disabled={create.isPending}>
          Create code
        </Button>
        <Button type="button" variant="ghost" size="md" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

export function CouponManager() {
  const [state, setState] = useUrlState({ page: "1", q: "" })
  const [rawQuery, setRawQuery] = React.useState(state.q)
  const [creating, setCreating] = React.useState(false)
  const debounced = useDebounce(rawQuery, 350)

  React.useEffect(() => {
    if (debounced !== state.q) setState({ q: debounced, page: "1" })
  }, [debounced, state.q, setState])

  const page = Math.max(1, Number(state.page) || 1)
  const { data, isLoading, isError, error } = useCoupons({ page, q: state.q })
  const { expire } = useCouponMutations()

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        eyebrow="Console"
        title="Offers & codes"
        description="Discount codes customers can enter at checkout. Codes are validated server-side, so a stale one cannot be forced through."
        actions={
          !creating ? (
            <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
              <Plus className="size-4" strokeWidth={2.2} />
              New code
            </Button>
          ) : null
        }
      />

      {creating ? <CreateForm onDone={() => setCreating(false)} /> : null}

      <div className="relative max-w-[380px]">
        <Search
          className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-dim"
          strokeWidth={1.9}
        />
        <Input
          value={rawQuery}
          onChange={(e) => setRawQuery(e.target.value)}
          placeholder="Search codes"
          aria-label="Search codes"
          className="pl-11 uppercase"
        />
      </div>

      {isError ? (
        <EmptyState
          title="Could not load codes"
          description={error instanceof Error ? error.message : undefined}
        />
      ) : isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-white/5" />
          ))}
        </div>
      ) : !data || data.data.length === 0 ? (
        <EmptyState
          title="No discount codes yet"
          description="Create one and it works at checkout immediately."
          action={
            <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
              <Plus className="size-4" strokeWidth={2.2} />
              New code
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {data.data.map((c) => (
            <div
              key={c.id}
              className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-card border border-white/[0.09] bg-carbon p-5"
            >
              <span className="font-display text-[24px] tracking-[0.08em] text-bone">{c.code}</span>
              <Badge variant={STATE_TONE[c.state]}>{c.state}</Badge>

              <span className="text-[14px] text-bone">
                {c.kind === "PERCENT" ? `${Number(c.value)}% off` : <><Money value={c.value} /> off</>}
              </span>

              <span className="text-[13px] text-ash">
                {Number(c.minSubtotal) > 0 ? <>min <Money value={c.minSubtotal} /></> : "no minimum"}
              </span>

              <span className="font-mono text-[12px] text-dim">
                used {c.usedCount}
                {c.maxUses !== null ? ` / ${c.maxUses}` : ""}
              </span>

              {c.expiresAt ? (
                <span className="font-mono text-[12px] text-dim">
                  {c.state === "EXPIRED" ? "expired" : "expires"}{" "}
                  {new Date(c.expiresAt).toLocaleDateString("en-IN")}
                </span>
              ) : null}

              <span className="ml-auto">
                {c.state === "ACTIVE" ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={expire.isPending}
                    onClick={() => expire.mutate(c.id)}
                  >
                    Expire
                  </Button>
                ) : null}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
