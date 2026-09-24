"use client"

import * as React from "react"
import { Percent, Plus, Search, Ticket, X } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { Money } from "@/components/shared/money"
import { PageHeader } from "@/components/shared/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DataTable, type Column } from "@/components/ui/data-table"
import { DateField } from "@/components/ui/date-field"
import { Field, Input } from "@/components/ui/input"
import { useCouponMutations, useCoupons, type CouponRow } from "@/features/coupons/hooks/use-coupons"
import { useDebounce } from "@/hooks/use-debounce"
import { useUrlState } from "@/hooks/use-url-state"
import { cn } from "@/lib/utils"

const STATE_TONE = {
  ACTIVE: "acid",
  EXPIRED: "muted",
  EXHAUSTED: "ember",
} as const

/** Digits only, so `onlyDigits("1a2") === "12"` and an empty box stays empty. */
const onlyDigits = (s: string) => s.replace(/[^0-9]/g, "")

function CreateForm({ onDone }: { onDone: () => void }) {
  const { create } = useCouponMutations()
  const [kind, setKind] = React.useState<"PERCENT" | "FLAT">("FLAT")
  const [error, setError] = React.useState<string | null>(null)

  // The amounts are held here rather than read off the form on submit. They
  // used to be <input type="number">, which brought two problems with it: a
  // spinner that invites clicking a value up one press at a time, and a wheel
  // that quietly edits a focused field while you scroll past — 250 became 251
  // on one notch. Plain text boxes filtered to digits have neither.
  const [amount, setAmount] = React.useState("")
  const [minSubtotal, setMinSubtotal] = React.useState("")
  const [maxUses, setMaxUses] = React.useState("")
  const [expiresAt, setExpiresAt] = React.useState("")

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    const form = new FormData(event.currentTarget)

    if (!amount) {
      setError(kind === "FLAT" ? "Enter an amount to take off." : "Enter a percentage.")
      return
    }
    if (kind === "PERCENT" && Number(amount) > 100) {
      setError("A percentage cannot be over 100.")
      return
    }

    try {
      await create.mutateAsync({
        code: String(form.get("code") ?? "")
          .trim()
          .toUpperCase(),
        kind,
        value: Number(amount),
        // Blank means no minimum, which is zero.
        minSubtotal: Number(minSubtotal || 0),
        // Blank means unlimited, which the service reads as null.
        maxUses: maxUses ? Number(maxUses) : null,
        // The field hands back local YYYY-MM-DD; end the day rather than
        // start it, or a code set to expire today dies at midnight.
        expiresAt: expiresAt ? new Date(expiresAt + "T23:59:59").toISOString() : null,
      })
      onDone()
    } catch {
      setError("Check the fields and try again.")
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-md border-blaze/30 bg-carbon border bg-[linear-gradient(160deg,rgb(255_90_31_/_0.06),transparent_50%)] p-6"
    >
      <div className="mb-5 flex items-center justify-between">
        <h2 className="font-display text-bone text-[22px] uppercase">New discount code</h2>
        <button
          type="button"
          onClick={onDone}
          aria-label="Close"
          className="text-dim hover:text-bone"
        >
          <X className="size-5" strokeWidth={2} />
        </button>
      </div>

      <div className="mb-4 flex flex-col gap-2.5">
        <span className="text-dim font-mono text-[10.5px] tracking-[0.16em] uppercase">Type</span>
        <div className="flex gap-2.5">
          {(["FLAT", "PERCENT"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={cn(
                "flex min-h-11 items-center gap-2 rounded-md border px-5 text-[13.5px] transition-colors",
                kind === k
                  ? "border-blaze bg-blaze/12 text-bone font-semibold"
                  : "text-ash border-white/[0.14] hover:border-white/30",
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
          <Input
            value={amount}
            onChange={(e) => setAmount(onlyDigits(e.target.value))}
            inputMode="numeric"
            autoComplete="off"
            placeholder={kind === "FLAT" ? "250" : "10"}
            className="font-mono"
          />
        </Field>
        <Field label="Minimum subtotal (₹)">
          {/* Placeholder, not a value. It held a literal 0 before, so typing
              500 into it gave 0500 unless you deleted the zero first. */}
          <Input
            value={minSubtotal}
            onChange={(e) => setMinSubtotal(onlyDigits(e.target.value))}
            inputMode="numeric"
            autoComplete="off"
            placeholder="0"
            className="font-mono"
          />
        </Field>
        <Field label="Max uses (blank = unlimited)">
          <Input
            value={maxUses}
            onChange={(e) => setMaxUses(onlyDigits(e.target.value))}
            inputMode="numeric"
            autoComplete="off"
            placeholder="100"
            className="font-mono"
          />
        </Field>
        <Field label="Expires (blank = never)" className="sm:col-span-2">
          <DateField
            name="expiresAt"
            value={expiresAt}
            onChange={setExpiresAt}
            placeholder="Never expires"
          />
        </Field>
      </div>

      {error ? <p className="text-magenta mt-4 text-[13.5px]">{error}</p> : null}

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
  // Search lives in the URL so a filtered view is shareable; paging is the
  // table's job now, over the window the server sent.
  const [state, setState] = useUrlState({ q: "" })
  const [rawQuery, setRawQuery] = React.useState(state.q)
  const [creating, setCreating] = React.useState(false)
  const debounced = useDebounce(rawQuery, 350)

  React.useEffect(() => {
    if (debounced !== state.q) setState({ q: debounced })
  }, [debounced, state.q, setState])

  const { data, isLoading, isError, error } = useCoupons({ page: 1, q: state.q })
  const { expire } = useCouponMutations()

  const columns: Column<CouponRow>[] = [
    {
      key: "code",
      header: "Code",
      value: (c) => c.code,
      cell: (c) => (
        <span className="font-display text-bone text-[20px] tracking-[0.08em]">{c.code}</span>
      ),
    },
    {
      key: "state",
      header: "State",
      value: (c) => c.state,
      cell: (c) => <Badge variant={STATE_TONE[c.state]}>{c.state}</Badge>,
    },
    {
      key: "value",
      header: "Discount",
      align: "right",
      // Percent and flat are different units, so this sorts within a kind
      // rather than pretending 10% and ₹250 sit on one scale.
      value: (c) => Number(c.value),
      cell: (c) => (
        <span className="text-bone text-[14px]">
          {c.kind === "PERCENT" ? (
            `${Number(c.value)}% off`
          ) : (
            <>
              <Money value={c.value} /> off
            </>
          )}
        </span>
      ),
    },
    {
      key: "min",
      header: "Minimum",
      align: "right",
      value: (c) => Number(c.minSubtotal),
      cell: (c) => (
        <span className="text-ash text-[13px]">
          {Number(c.minSubtotal) > 0 ? <Money value={c.minSubtotal} /> : "-"}
        </span>
      ),
    },
    {
      key: "used",
      header: "Used",
      align: "right",
      value: (c) => c.usedCount,
      cell: (c) => (
        <span className="text-dim font-mono text-[12px]">
          {c.usedCount}
          {c.maxUses !== null ? ` / ${c.maxUses}` : ""}
        </span>
      ),
    },
    {
      key: "expires",
      header: "Expires",
      align: "right",
      value: (c) => c.expiresAt ?? "",
      cell: (c) => (
        <span className="text-dim font-mono text-[12px]">
          {c.expiresAt ? new Date(c.expiresAt).toLocaleDateString("en-IN") : "never"}
        </span>
      ),
    },
    {
      // No value: a button is not data.
      key: "actions",
      header: "",
      align: "right",
      cell: (c) =>
        c.state === "ACTIVE" ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={expire.isPending}
            onClick={() => expire.mutate(c.id)}
          >
            Expire
          </Button>
        ) : null,
    },
  ]

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
          className="text-dim pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2"
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
      ) : (
        <DataTable
          rows={data?.data ?? []}
          columns={columns}
          rowId={(c) => c.id}
          exportName="discount-codes"
          loading={isLoading}
          total={data?.pagination?.total}
          empty="No discount codes yet. Create one and it works at checkout immediately."
          exportColumns={[
            { header: "Code", value: (c) => c.code },
            { header: "State", value: (c) => c.state },
            { header: "Kind", value: (c) => c.kind },
            { header: "Value", value: (c) => Number(c.value) },
            { header: "Minimum", value: (c) => Number(c.minSubtotal) },
            { header: "Used", value: (c) => c.usedCount },
            { header: "Max uses", value: (c) => c.maxUses ?? "" },
            {
              header: "Expires",
              value: (c) => (c.expiresAt ? new Date(c.expiresAt).toLocaleDateString("en-IN") : ""),
            },
          ]}
        />
      )}
    </div>
  )
}
