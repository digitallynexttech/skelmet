"use client"

import * as React from "react"
import Link from "next/link"
import { Archive, Percent, Plus, RotateCcw, Search, Ticket, X } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { Money } from "@/components/shared/money"
import { PageHeader } from "@/components/shared/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DataTable, type Column } from "@/components/ui/data-table"
import { DateField } from "@/components/ui/date-field"
import { Field, Input } from "@/components/ui/input"
import {
  useCouponMutations,
  useCoupons,
  type CouponRow,
  type CouponView,
} from "@/features/coupons/hooks/use-coupons"
import { useDebounce } from "@/hooks/use-debounce"
import { useUrlState } from "@/hooks/use-url-state"
import { ApiFetchError } from "@/lib/api-fetch"
import { cn } from "@/lib/utils"

const STATE_TONE = {
  ACTIVE: "acid",
  EXPIRED: "muted",
  EXHAUSTED: "ember",
} as const

const TABS: { id: CouponView; label: string }[] = [
  { id: "codes", label: "Codes" },
  { id: "archived", label: "Archive" },
]

// Stable, since useUrlState memoises on it.
const DEFAULTS = { q: "", view: "codes" }

/** An on/off switch, for whether a code is offered in the cart. */
function CartSwitch({
  on,
  label,
  disabled,
  onChange,
}: {
  on: boolean
  label: string
  disabled?: boolean
  onChange: (on: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors disabled:opacity-40",
        on ? "border-blaze bg-blaze" : "border-white/[0.18] bg-white/[0.06]",
      )}
    >
      <span
        className={cn(
          "bg-bone block size-[18px] rounded-full shadow transition-transform",
          on ? "translate-x-[22px]" : "translate-x-[3px]",
        )}
      />
    </button>
  )
}

/** Digits only, so `onlyDigits("1a2") === "12"` and an empty box stays empty. */
const onlyDigits = (s: string) => s.replace(/[^0-9]/g, "")

/** The form's amounts as the box shows them: digits, blank for none. */
const asBox = (n: number | string | null | undefined) =>
  n === null || n === undefined || Number(n) === 0 ? "" : String(Math.round(Number(n)))

/**
 * A new code, or - given `renewing` - an old one run again with new terms.
 * Renewing keeps the code (past orders point at it), starts the uses again
 * and brings it out of the archive; the old expiry is not carried over.
 */
function CreateForm({ onDone, renewing }: { onDone: () => void; renewing?: CouponRow }) {
  const { create, renew } = useCouponMutations()
  const [kind, setKind] = React.useState<"PERCENT" | "FLAT">(renewing?.kind ?? "FLAT")
  // A code typed here that turned out to exist and to be over: the way to
  // renew it instead, with what is in the form.
  const [clash, setClash] = React.useState<{ id: string; code: string } | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  // What is wrong with each field, shown under it: from the checks below
  // before sending, or from the server's answer.
  const [fields, setFields] = React.useState<Record<string, string>>({})

  // The amounts are held here rather than read off the form on submit. They
  // used to be <input type="number">, which brought two problems with it: a
  // spinner that invites clicking a value up one press at a time, and a wheel
  // that quietly edits a focused field while you scroll past — 250 became 251
  // on one notch. Plain text boxes filtered to digits have neither.
  const [amount, setAmount] = React.useState(asBox(renewing?.value))
  const [minSubtotal, setMinSubtotal] = React.useState(asBox(renewing?.minSubtotal))
  const [maxUses, setMaxUses] = React.useState(asBox(renewing?.maxUses))
  const [expiresAt, setExpiresAt] = React.useState("")
  const [showInCart, setShowInCart] = React.useState(renewing?.showInCart ?? false)

  /** The form's terms as the API takes them. */
  const terms = () => ({
    kind,
    value: Number(amount),
    // Blank means no minimum, which is zero.
    minSubtotal: Number(minSubtotal || 0),
    // Blank means unlimited, which the service reads as null.
    maxUses: maxUses ? Number(maxUses) : null,
    // The field hands back local YYYY-MM-DD; end the day rather than
    // start it, or a code set to expire today dies at midnight.
    expiresAt: expiresAt ? new Date(expiresAt + "T23:59:59").toISOString() : null,
    showInCart,
  })

  async function renewInstead(id: string) {
    setError(null)
    setFields({})
    try {
      await renew.mutateAsync({ id, input: terms() })
      onDone()
    } catch (err) {
      if (err instanceof ApiFetchError) {
        setFields(err.fieldErrors)
        setError(err.message)
      } else {
        setError("The code was not renewed - the connection may have dropped. Try again.")
      }
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setFields({})
    setClash(null)
    const form = new FormData(event.currentTarget)
    const code = renewing
      ? renewing.code
      : String(form.get("code") ?? "")
          .trim()
          .toUpperCase()

    // The server's own rules, checked here first so the answer is instant
    // and sits under the box it is about.
    const found: Record<string, string> = {}
    if (!/^[A-Z0-9-]{3,24}$/.test(code)) {
      found.code =
        code.length < 3
          ? "At least 3 characters - letters, numbers and dashes"
          : code.length > 24
            ? "24 characters at most"
            : "Letters, numbers and dashes only - no spaces or symbols"
    }
    if (!amount) {
      found.value = kind === "FLAT" ? "Enter an amount to take off" : "Enter a percentage"
    } else if (kind === "PERCENT" && Number(amount) > 90) {
      found.value = "90% at most - above that is almost always a typo for a flat amount"
    }
    if (Object.keys(found).length > 0) {
      setFields(found)
      setError(
        Object.keys(found).length === 1
          ? "Fix the field marked below."
          : "Fix the fields marked below.",
      )
      return
    }

    if (renewing) {
      await renewInstead(renewing.id)
      return
    }

    try {
      await create.mutateAsync({ code, ...terms() })
      onDone()
    } catch (err) {
      // The server's own words: which field, and what is wrong with it.
      if (err instanceof ApiFetchError) {
        setFields(err.fieldErrors)
        setError(err.message)
        const existing = (
          err.details as { existing?: { id: string; code: string; renewable: boolean } }
        )?.existing
        if (existing?.renewable) setClash({ id: existing.id, code: existing.code })
      } else {
        setError("The code was not created - the connection may have dropped. Try again.")
      }
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border-blaze/30 bg-carbon rounded-md border bg-[linear-gradient(160deg,rgb(255_90_31_/_0.06),transparent_50%)] p-6"
    >
      <div className="mb-5 flex items-center justify-between">
        <h2 className="font-display text-bone text-[22px] uppercase">
          {renewing ? `Renew ${renewing.code}` : "New discount code"}
        </h2>
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
        <Field
          label="Code"
          error={fields.code}
          hint={
            renewing
              ? `Kept as it is. Uses start again from 0; ${renewing.usedCount} were used before.`
              : "3 to 24 letters, numbers or dashes"
          }
        >
          <Input
            name="code"
            required
            placeholder="SKULL250"
            defaultValue={renewing?.code}
            readOnly={Boolean(renewing)}
            onChange={() => setClash(null)}
            className="font-mono uppercase read-only:opacity-70"
          />
        </Field>
        <Field label={kind === "FLAT" ? "Amount off (₹)" : "Percent off"} error={fields.value}>
          <Input
            value={amount}
            onChange={(e) => setAmount(onlyDigits(e.target.value))}
            inputMode="numeric"
            autoComplete="off"
            placeholder={kind === "FLAT" ? "250" : "10"}
            className="font-mono"
          />
        </Field>
        <Field label="Minimum subtotal (₹)" error={fields.minSubtotal}>
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
        <Field label="Max uses (blank = unlimited)" error={fields.maxUses}>
          <Input
            value={maxUses}
            onChange={(e) => setMaxUses(onlyDigits(e.target.value))}
            inputMode="numeric"
            autoComplete="off"
            placeholder="100"
            className="font-mono"
          />
        </Field>
        <Field label="Expires (blank = never)" className="sm:col-span-2" error={fields.expiresAt}>
          <DateField
            name="expiresAt"
            value={expiresAt}
            onChange={setExpiresAt}
            placeholder="Never expires"
          />
        </Field>
        <div className="flex items-center justify-between gap-4 rounded-md border border-white/[0.1] px-4 py-3 sm:col-span-2">
          <div>
            <div className="text-bone text-[14px] font-semibold">Show in cart</div>
            <div className="text-dim text-[12.5px]">
              Offered in the cart under Coupons &amp; offers, for the buyer to apply with a tap.
            </div>
          </div>
          <CartSwitch on={showInCart} label="Show in cart" onChange={setShowInCart} />
        </div>
      </div>

      {error ? <p className="text-magenta mt-4 text-[13.5px]">{error}</p> : null}

      <div className="mt-6 flex flex-wrap gap-2.5">
        {clash ? (
          <Button
            type="button"
            variant="primary"
            size="md"
            disabled={renew.isPending}
            onClick={() => void renewInstead(clash.id)}
          >
            <RotateCcw className="size-4" strokeWidth={2.2} />
            Renew {clash.code}
          </Button>
        ) : (
          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={create.isPending || renew.isPending}
          >
            {renewing ? "Renew code" : "Create code"}
          </Button>
        )}
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
  const [state, setState] = useUrlState(DEFAULTS)
  const view: CouponView = state.view === "archived" ? "archived" : "codes"
  const [rawQuery, setRawQuery] = React.useState(state.q)
  const [creating, setCreating] = React.useState(false)
  const [renewing, setRenewing] = React.useState<CouponRow | null>(null)
  const openForm = (row: CouponRow | null) => {
    setRenewing(row)
    setCreating(true)
    window.scrollTo({ top: 0 })
  }
  const closeForm = () => {
    setCreating(false)
    setRenewing(null)
  }
  const debounced = useDebounce(rawQuery, 350)

  React.useEffect(() => {
    if (debounced !== state.q) setState({ q: debounced })
  }, [debounced, state.q, setState])

  const { data, isLoading, isError, error } = useCoupons({ page: 1, q: state.q, view })
  const { expire, archive, restore, showInCart } = useCouponMutations()

  const columns: Column<CouponRow>[] = [
    {
      key: "code",
      header: "Code",
      value: (c) => c.code,
      // Opens the code's own page: its runs, its orders and its log.
      cell: (c) => (
        <Link
          href={`/admin/coupons/${encodeURIComponent(c.code)}`}
          className="font-display text-bone hover:text-blaze text-[20px] tracking-[0.08em] underline-offset-4 transition-colors hover:underline"
        >
          {c.code}
        </Link>
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
    ...(view === "codes"
      ? [
          {
            key: "cart",
            header: "In cart",
            align: "right",
            value: (c: CouponRow) => (c.showInCart ? 1 : 0),
            // A code that cannot be used is not offered, whatever the switch
            // says; it is shown off, and can be switched on again after an edit.
            cell: (c: CouponRow) => (
              <CartSwitch
                on={c.showInCart && c.state === "ACTIVE"}
                label={`Show ${c.code} in cart`}
                disabled={c.state !== "ACTIVE" || showInCart.isPending}
                onChange={(on) => showInCart.mutate({ id: c.id, show: on })}
              />
            ),
          } satisfies Column<CouponRow>,
        ]
      : []),
    {
      // No value: a button is not data.
      key: "actions",
      header: "",
      align: "right",
      cell: (c) =>
        view === "archived" ? (
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => openForm(c)}>
              Renew
            </Button>
            <Button
              variant="quiet"
              size="sm"
              disabled={restore.isPending}
              onClick={() => restore.mutate(c.id)}
            >
              <RotateCcw className="size-4" strokeWidth={2} />
              Restore
            </Button>
          </div>
        ) : (
          <div className="flex justify-end gap-2">
            {c.state !== "ACTIVE" ? (
              <Button variant="ghost" size="sm" onClick={() => openForm(c)}>
                Renew
              </Button>
            ) : null}
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
            <Button
              variant="quiet"
              size="sm"
              disabled={archive.isPending}
              onClick={() => archive.mutate(c.id)}
              aria-label={`Archive ${c.code}`}
              title="Archive"
            >
              <Archive className="size-4" strokeWidth={1.9} />
              Archive
            </Button>
          </div>
        ),
    },
  ]

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        title="Offers & codes"
        description="Discount codes customers can enter at checkout, or apply in the cart when In cart is on. Archived codes stop working and move to the Archive tab."
        actions={
          !creating ? (
            <Button variant="primary" size="sm" onClick={() => openForm(null)}>
              <Plus className="size-4" strokeWidth={2.2} />
              New code
            </Button>
          ) : null
        }
      />

      {creating ? (
        <CreateForm
          key={renewing?.id ?? "new"}
          renewing={renewing ?? undefined}
          onDone={closeForm}
        />
      ) : null}

      <div
        role="tablist"
        aria-label="Offers and codes"
        className="flex gap-1 overflow-x-auto border-b border-white/[0.09]"
      >
        {TABS.map((tab) => {
          const selected = tab.id === view
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setState({ view: tab.id })}
              className={cn(
                "-mb-px flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-4 text-[14px] whitespace-nowrap transition-colors",
                selected
                  ? "border-blaze text-bone font-semibold"
                  : "text-ash hover:text-bone border-transparent",
              )}
            >
              {tab.label}
              {selected && typeof data?.pagination?.total === "number" ? (
                <span className="text-dim font-mono text-[11px] font-normal">
                  {data.pagination.total}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>

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
          empty={
            view === "archived"
              ? "Nothing archived. Archive a code from the Codes tab to put it away here."
              : "No discount codes yet. Create one and it works at checkout immediately."
          }
          exportColumns={[
            { header: "Code", value: (c) => c.code },
            { header: "State", value: (c) => c.state },
            { header: "Kind", value: (c) => c.kind },
            { header: "Value", value: (c) => Number(c.value) },
            { header: "Minimum", value: (c) => Number(c.minSubtotal) },
            { header: "Used", value: (c) => c.usedCount },
            { header: "Max uses", value: (c) => c.maxUses ?? "" },
            { header: "In cart", value: (c) => (c.showInCart ? "yes" : "no") },
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
