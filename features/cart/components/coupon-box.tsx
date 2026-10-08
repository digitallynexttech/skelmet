"use client"

import * as React from "react"
import { Check, Tag, X } from "lucide-react"

import { Money } from "@/components/shared/money"
import { Input } from "@/components/ui/input"
import { useCart } from "@/features/cart/hooks/use-cart"
import { ApiFetchError, apiFetch } from "@/lib/api-fetch"
import { cn } from "@/lib/utils"

export type AppliedCoupon = { code: string; discount: number; label: string }

/** A code offered in the cart (listCartOffers). */
export type CartOffer = {
  code: string
  label: string
  minSubtotal: string
  expiresAt: string | null
}

/** The server refused the code, as opposed to the check failing. */
function refused(err: unknown) {
  return err instanceof ApiFetchError && (err.status === 400 || err.status === 422)
}

/** The discount box. A preview only: checkout re-reads the coupon and re-prices the order. */
export function CouponBox({
  subtotal,
  applied,
  onApplied,
  code: ownCode,
  onCode,
  recheck = true,
  className = "mb-6",
  offers = [],
}: {
  subtotal: number
  applied: AppliedCoupon | null
  onApplied: (c: AppliedCoupon | null) => void
  /** With `onCode`, keeps the code off the cart (a Buy-now checkout). */
  code?: string | null
  onCode?: (code: string | null) => void
  /** Re-check as the subtotal moves. With two boxes on a page, only one should. */
  recheck?: boolean
  className?: string
  offers?: CartOffer[]
}) {
  const cartCode = useCart((s) => s.couponCode)
  const setCartCode = useCart((s) => s.setCoupon)
  const couponCode = onCode ? (ownCode ?? null) : cartCode
  const setCoupon = onCode ?? setCartCode

  const [error, setError] = React.useState<string | null>(null)
  const [pending, setPending] = React.useState(false)

  // Re-check (debounced) as the subtotal moves: it can fall under the minimum.
  // Only a refusal removes the code, not a rate limit or a dropped connection.
  React.useEffect(() => {
    if (!couponCode || !recheck) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      void apiFetch<AppliedCoupon>("/api/coupons/validate", {
        method: "POST",
        body: JSON.stringify({ code: couponCode, subtotal }),
      })
        .then((c) => {
          if (!cancelled) onApplied(c)
        })
        .catch((err: unknown) => {
          if (cancelled || !refused(err)) return
          onApplied(null)
          setCoupon(null)
        })
    }, 350)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [couponCode, subtotal, recheck, setCoupon, onApplied])

  const [draft, setDraft] = React.useState("")

  async function apply(given?: string) {
    const code = (given ?? draft).trim()
    if (code === "" || pending) return

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
      // A refused code replaces whatever was on; a failed check leaves it be.
      if (refused(err)) {
        onApplied(null)
        setCoupon(null)
      }
      setError(err instanceof ApiFetchError ? err.message : "That didn't work. Try again.")
    } finally {
      setPending(false)
    }
  }

  // Derived from the store, so removing a code cannot leave a stale panel.
  const shown = couponCode ? applied : null

  const list =
    offers.length > 0 ? (
      <ul className="mt-3 flex flex-col gap-2.5">
        {offers.map((offer) => {
          const on = shown?.code === offer.code
          const short = Number(offer.minSubtotal) - subtotal
          return (
            <li
              key={offer.code}
              className={cn(
                "flex items-center gap-3 rounded-lg border border-dashed px-3.5 py-3",
                on ? "border-acid/45 bg-acid/[0.05]" : "border-white/[0.16]",
              )}
            >
              <Tag
                className={cn("size-4 shrink-0", on ? "text-acid" : "text-ember")}
                strokeWidth={1.8}
              />
              <div className="min-w-0 flex-1">
                <div className="text-bone truncate font-mono text-[13px] font-bold tracking-[0.08em]">
                  {offer.code}
                </div>
                <div className="text-dim mt-0.5 text-[12px] leading-snug">
                  {offer.label}
                  {Number(offer.minSubtotal) > 0 ? (
                    <>
                      {" "}
                      on orders over <Money value={offer.minSubtotal} />
                    </>
                  ) : null}
                  {short > 0 ? (
                    <span className="text-ember block">
                      Add <Money value={short} /> more to use it
                    </span>
                  ) : null}
                </div>
              </div>
              {on ? (
                <span className="text-acid shrink-0 font-mono text-[11px] font-bold tracking-[0.12em]">
                  APPLIED
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => void apply(offer.code)}
                  disabled={pending}
                  aria-label={`Apply ${offer.code}`}
                  className="text-acid hover:text-bone shrink-0 font-mono text-[11.5px] font-bold tracking-[0.12em] transition-colors disabled:opacity-50"
                >
                  APPLY
                </button>
              )}
            </li>
          )
        })}
      </ul>
    ) : null

  if (shown) {
    return (
      <div className={className}>
        <div className="border-acid/35 bg-acid/[0.06] flex h-13 items-center gap-2.5 rounded-lg border px-4">
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
        {list}
      </div>
    )
  }

  return (
    <div className={className}>
      <div className="bg-void flex h-13 items-center gap-2.5 rounded-lg border border-white/[0.12] px-4">
        <Tag className="text-ember size-4 shrink-0" strokeWidth={1.8} />
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Discount code"
          aria-label="Discount code"
          onKeyDown={(e) => {
            // Enter applies the code without submitting the order form around it.
            if (e.key !== "Enter") return
            e.preventDefault()
            void apply()
          }}
          // Tighter on a 320px phone, where "Discount code" is otherwise cut short.
          className="h-full min-w-0 flex-1 border-0 bg-transparent px-0 font-mono text-[15px] tracking-[0.08em] focus:ring-0 max-[359px]:text-[13.5px] max-[359px]:tracking-normal"
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
      {list}
    </div>
  )
}
