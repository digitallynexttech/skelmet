"use client"

import { ArrowRight } from "lucide-react"

import { Money } from "@/components/shared/money"
import { ButtonLink } from "@/components/ui/button"
import { buyNowHref, useBuySelection } from "@/features/catalog/hooks/use-buy-selection"

/**
 * Phone-only. Buy now goes straight to checkout with the buy panel's colourway and quantity,
 * leaving the cart untouched.
 */
export function StickyBuyBar({
  productSlug,
  price,
  defaultColourway,
}: {
  productSlug: string
  price: string
  defaultColourway: string
}) {
  const colourway = useBuySelection((s) => s.colourway) ?? defaultColourway
  const qty = useBuySelection((s) => s.qty)
  const picked = useBuySelection((s) => s.price) ?? price
  const freeShipping = useBuySelection((s) => s.freeShipping)

  // Near-opaque, not blurred: a backdrop blur janks scrolling on phones. `data-sticky-bar` lifts
  // the floating buttons clear of it.
  return (
    <div
      data-sticky-bar
      className="bg-void/97 sticky bottom-0 z-40 flex items-center gap-3 border-t border-white/10 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] lg:hidden"
    >
      <div className="shrink-0">
        <Money value={picked} className="font-display text-bone text-[26px] leading-none" />
        <div className="text-dim mt-1 font-mono text-[10px] tracking-[0.1em] uppercase">
          {freeShipping ? "Free shipping" : "Shipping by pincode"}
        </div>
      </div>
      {/* Tighter below 360px, where it would otherwise overhang. */}
      <ButtonLink
        href={buyNowHref(colourway, qty, productSlug)}
        variant="primary"
        size="md"
        full
        className="flex-1 max-[359px]:px-4"
      >
        Buy now
        <ArrowRight className="size-4" strokeWidth={2.4} />
      </ButtonLink>
    </div>
  )
}
