"use client"

import { ArrowRight } from "lucide-react"

import { Money } from "@/components/shared/money"
import { ButtonLink } from "@/components/ui/button"

/**
 * Phone-only. Sits above the safe area so it clears the home indicator on iOS.
 */
export function StickyBuyBar({ price, label = "Add to cart" }: { price: string; label?: string }) {
  return (
    <div className="bg-void/92 sticky bottom-0 z-40 flex items-center gap-3 border-t border-white/10 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-xl lg:hidden">
      <div className="shrink-0">
        <Money value={price} className="font-display text-bone text-[26px] leading-none" />
        <div className="text-dim mt-1 font-mono text-[9.5px] tracking-[0.1em]">FREE SHIPPING</div>
      </div>
      <ButtonLink href="/cart" variant="primary" size="md" full className="flex-1">
        {label}
        <ArrowRight className="size-4" strokeWidth={2.4} />
      </ButtonLink>
    </div>
  )
}
