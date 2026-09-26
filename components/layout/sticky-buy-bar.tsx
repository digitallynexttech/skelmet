"use client"

import { ArrowRight } from "lucide-react"

import { Money } from "@/components/shared/money"
import { ButtonLink } from "@/components/ui/button"
import { buyNowHref, useBuySelection } from "@/features/catalog/hooks/use-buy-selection"

/**
 * Phone-only. Sits above the safe area so it clears the home indicator on iOS.
 *
 * Buy now goes straight to checkout with the colourway and quantity picked in
 * the buy panel - `defaultColourway` until the panel has said - leaving the
 * cart as it is, the same as the panel's own Buy it now.
 */
export function StickyBuyBar({
  price,
  defaultColourway,
}: {
  price: string
  defaultColourway: string
}) {
  const colourway = useBuySelection((s) => s.colourway) ?? defaultColourway
  const qty = useBuySelection((s) => s.qty)

  return (
    <div className="bg-void/92 sticky bottom-0 z-40 flex items-center gap-3 border-t border-white/10 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-xl lg:hidden">
      <div className="shrink-0">
        <Money value={price} className="font-display text-bone text-[26px] leading-none" />
        <div className="text-dim mt-1 font-mono text-[9.5px] tracking-[0.1em]">
          SHIPPING BY PINCODE
        </div>
      </div>
      {/* Tighter on the narrowest phones, which it otherwise overhangs. */}
      <ButtonLink
        href={buyNowHref(colourway, qty)}
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
