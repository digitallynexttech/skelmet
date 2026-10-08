"use client"

import * as React from "react"
import Link from "next/link"
import { Archive, Percent, RotateCcw, Ticket, X } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { Money } from "@/components/shared/money"
import { PageHeader } from "@/components/shared/page-header"
import { Badge } from "@/components/ui/badge"
import { DataTable, type Column, type DataTableHandle } from "@/components/ui/data-table"
import { DateField } from "@/components/ui/date-field"
import { ExportMenu } from "@/components/ui/export-menu"
import { HeaderButton } from "@/components/ui/header-button"
import { Field, Input } from "@/components/ui/input"
import { TableSearch } from "@/components/ui/table-search"
import { ViewMenu } from "@/components/ui/view-menu"
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

// All is every code not archived.
const VIEWS: { value: CouponView; label: string }[] = [
  { value: "codes", label: "All" },
  { value: "archived", label: "Archived" },
]

// Stable, since useUrlState memoises on it.
const DEFAULTS = { q: "", view: "codes" }

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

const onlyDigits = (s: string) => s.replace(/[^0-9]/g, "")

/** An amount as its box shows it: digits, blank for none or zero. */
const asBox = (n: number | string | null | undefined) =>
  n === null || n === undefined || Number(n) === 0 ? "" : String(Math.round(Number(n)))

/**
 * A new code, or with `renewing` an old one run again with new terms: same
 * code, uses from 0, out of the archive, old expiry dropped.
 */
function CreateForm({ onDone, renewing }: { onDone: () => void; renewing?: CouponRow }) {
  const { create, renew } = useCouponMutations()
  const [kind, setKind] = React.useState<"PERCENT" | "FLAT">(renewing?.kind ?? "FLAT")
  // A typed code that exists and is over: offered for renewal instead.
  const [clash, setClash] = React.useState<{ id: string; code: string } | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [fields, setFields] = React.useState<Record<string, string>>({})

  // Digit-filtered text boxes, not type="number", whose scroll wheel edits a focused value.
  const [amount, setAmount] = React.useState(asBox(renewing?.value))
  const [minSubtotal, setMinSubtotal] = React.useState(asBox(renewing?.minSubtotal))
  const [maxUses, setMaxUses] = React.useState(asBox(renewing?.maxUses))
  const [expiresAt, setExpiresAt] = React.useState("")
  const [showInCart, setShowInCart] = React.useState(renewing?.showInCart ?? false)

  const terms = () => ({
    kind,
    value: Number(amount),
    minSubtotal: Number(minSubtotal || 0),
    // Blank is unlimited.
    maxUses: maxUses ? Number(maxUses) : null,
    // End of the local day, or a code expiring today dies at midnight.
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

    // The server's rules, checked first for an instant answer.
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
        <h2 className="text-bone text-[15px] font-semibold">
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
          {/* A placeholder 0, not a value, so typing 500 does not give 0500. */}
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
          <HeaderButton
            type="button"
            variant="primary"
            disabled={renew.isPending}
            onClick={() => void renewInstead(clash.id)}
          >
            <RotateCcw className="size-4" strokeWidth={2.2} />
            Renew {clash.code}
          </HeaderButton>
        ) : (
          <HeaderButton
            type="submit"
            variant="primary"
            disabled={create.isPending || renew.isPending}
          >
            {renewing ? "Renew code" : "Create code"}
          </HeaderButton>
        )}
        <HeaderButton type="button" onClick={onDone}>
          Cancel
        </HeaderButton>
      </div>
    </form>
  )
}

export function CouponManager() {
  // Search in the URL so a filtered view is shareable; the table pages.
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
  // The other view too, for its count in the view menu.
  const other = useCoupons({
    page: 1,
    q: state.q,
    view: view === "codes" ? "archived" : "codes",
  })
  const [thisCount, otherCount] = [data?.pagination?.total, other.data?.pagination?.total]
  const counts: Record<CouponView, number | undefined> =
    view === "codes"
      ? { codes: thisCount, archived: otherCount }
      : { codes: otherCount, archived: thisCount }
  const { expire, archive, restore, showInCart } = useCouponMutations()
  const table = React.useRef<DataTableHandle<CouponRow>>(null)

  const columns: Column<CouponRow>[] = [
    {
      key: "code",
      header: "Code",
      value: (c) => c.code,
      cell: (c) => (
        <Link
          href={`/admin/coupons/${encodeURIComponent(c.code)}`}
          className="text-bone hover:text-blaze font-mono text-[13px] font-semibold tracking-[0.04em] transition-colors"
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
      // Percent and flat are different units; the sort is only meaningful within a kind.
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
            // An unusable code is never offered, so it shows off whatever was saved.
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
      // No value, so it is not exported or sorted.
      key: "actions",
      header: "Actions",
      align: "right",
      cell: (c) =>
        view === "archived" ? (
          <div className="flex justify-end gap-2">
            <HeaderButton onClick={() => openForm(c)}>Renew</HeaderButton>
            <HeaderButton
              variant="quiet"
              disabled={restore.isPending}
              onClick={() => restore.mutate(c.id)}
            >
              <RotateCcw className="size-4" strokeWidth={2} />
              Restore
            </HeaderButton>
          </div>
        ) : (
          <div className="flex justify-end gap-2">
            {c.state !== "ACTIVE" ? (
              <HeaderButton onClick={() => openForm(c)}>Renew</HeaderButton>
            ) : null}
            {c.state === "ACTIVE" ? (
              <HeaderButton disabled={expire.isPending} onClick={() => expire.mutate(c.id)}>
                Expire
              </HeaderButton>
            ) : null}
            <HeaderButton
              variant="quiet"
              disabled={archive.isPending}
              onClick={() => archive.mutate(c.id)}
              aria-label={`Archive ${c.code}`}
              title="Stops the code working and moves it to Archived"
            >
              <Archive className="size-4" strokeWidth={1.9} />
              Archive
            </HeaderButton>
          </div>
        ),
    },
  ]

  const bar = (
    <div className="flex items-center gap-2">
      <ViewMenu
        value={view}
        onChange={(v) => setState({ view: v })}
        options={VIEWS.map((v) => ({ ...v, count: counts[v.value] }))}
      />
      <TableSearch
        value={rawQuery}
        onChange={setRawQuery}
        placeholder="Search codes"
        label="Search discount codes"
      />
    </div>
  )

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        icon={Percent}
        title="Offers & codes"
        actions={
          <>
            <ExportMenu table={table} noun={["code", "codes"]} />
            {!creating ? (
              <HeaderButton variant="primary" onClick={() => openForm(null)}>
                New code
              </HeaderButton>
            ) : null}
          </>
        }
      />

      {creating ? (
        <CreateForm
          key={renewing?.id ?? "new"}
          renewing={renewing ?? undefined}
          onDone={closeForm}
        />
      ) : null}

      {isError ? (
        <EmptyState
          title="Could not load codes"
          description={error instanceof Error ? error.message : undefined}
        />
      ) : (
        <DataTable
          handle={table}
          rows={data?.data ?? []}
          columns={columns}
          rowId={(c) => c.id}
          exportName="discount-codes"
          exportButtons={false}
          pageKey={`${view}|${state.q}`}
          bar={bar}
          loading={isLoading}
          total={data?.pagination?.total}
          empty={
            state.q
              ? "No code matches that search."
              : view === "archived"
                ? "Nothing archived. Archiving a code stops it working and puts it here, to restore or renew."
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
