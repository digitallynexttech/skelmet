"use client"

import * as React from "react"
import { Check, Tag, X } from "lucide-react"

import { Input } from "@/components/ui/input"
import { useCart } from "@/features/cart/hooks/use-cart"
import { ApiFetchError, apiFetch } from "@/lib/api-fetch"

export type AppliedCoupon = { code: string; discount: number; label: string }

/**
 * The discount box that used to be decoration: a form whose only handler was
 * `preventDefault`, next to a `/api/coupons/validate` endpoint that already
 * worked and had no caller.
 *
 * What it shows is a preview. The code is kept on the cart so checkout can
 * send it, but checkout re-reads the coupon from the database and re-prices
 * the whole order, so nothing decided here can change what is charged.
 */
export function CouponBox({
  subtotal,
  applied,
  onApplied,
}: {
  subtotal: number
  applied: AppliedCoupon | null
  onApplied: (c: AppliedCoupon | null) => void
}) {
  const couponCode = useCart((s) => s.couponCode)
  const setCoupon = useCart((s) => s.setCoupon)

  const [error, setError] = React.useState<string | null>(null)
  const [pending, setPending] = React.useState(false)

  // Re-check on mount and whenever the subtotal moves: a code valid at three
  // items can fall under its minimum when one is removed, and the customer
  // should not reach checkout still believing it applies.
  React.useEffect(() => {
    // No synchronous clear here — with no code there is simply nothing to
    // check, and `shown` below derives the empty state instead. Writing it
    // back through setState would schedule a second render for a fact already
    // visible in the store.
    if (!couponCode) return
    let cancelled = false
    void apiFetch<AppliedCoupon>("/api/coupons/validate", {
      method: "POST",
      body: JSON.stringify({ code: couponCode, subtotal }),
    })
      .then((c) => {
        if (!cancelled) onApplied(c)
      })
      .catch(() => {
        if (cancelled) return
        onApplied(null)
        setCoupon(null)
      })
    return () => {
      cancelled = true
    }
  }, [couponCode, subtotal, setCoupon, onApplied])

  const [draft, setDraft] = React.useState("")

  async function apply() {
    const code = draft.trim()
    if (code === "") return

    setError(null)
    setPending(true)
    try {
      const c = await apiFetch<AppliedCoupon>("/api/coupons/validate", {
        method: "POST",
        body: JSON.stringify({ code, subtotal }),
      })
      onApplied(c)
      setCoupon(c.code)
    } catch (err) {
      onApplied(null)
      setCoupon(null)
      setError(err instanceof ApiFetchError ? err.message : "That didn't work. Try again.")
    } finally {
      setPending(false)
    }
  }

  // Derived, not stored: the store is the single source of whether a code is
  // on the cart, so removing one cannot leave a stale panel behind.
  const shown = couponCode ? applied : null

  if (shown) {
    return (
      <div className="border-acid/35 bg-acid/[0.06] mb-6 flex h-13 items-center gap-2.5 rounded-xl border px-4">
        <Check className="text-acid size-4 shrink-0" strokeWidth={2.4} />
        <span className="text-bone flex-1 font-mono text-[13px] tracking-[0.08em]">
          {shown.code}
        </span>
        <button
          type="button"
          onClick={() => {
            onApplied(null)
            setCoupon(null)
          }}
          aria-label={`Remove discount code ${shown.code}`}
          className="text-dim hover:text-bone shrink-0"
        >
          <X className="size-4" strokeWidth={2.2} />
        </button>
      </div>
    )
  }

  return (
    <div className="mb-6">
      <div className="bg-void flex h-13 items-center gap-2.5 rounded-xl border border-white/[0.12] px-4">
        <Tag className="text-ember size-4 shrink-0" strokeWidth={1.8} />
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Discount code"
          aria-label="Discount code"
          onKeyDown={(e) => {
            // Enter applies the code without reaching the order form around it.
            if (e.key !== "Enter") return
            e.preventDefault()
            void apply()
          }}
          className="h-auto border-0 bg-transparent px-0 font-mono text-[13px] tracking-[0.08em] focus:ring-0"
        />
        <button
          type="button"
          onClick={() => void apply()}
          disabled={pending}
          className="text-acid shrink-0 font-mono text-[11.5px] font-bold tracking-[0.12em] disabled:opacity-50"
        >
          {pending ? "…" : "APPLY"}
        </button>
      </div>
      {error ? <p className="text-magenta mt-2 text-[12.5px] leading-[1.45]">{error}</p> : null}
    </div>
  )
}
