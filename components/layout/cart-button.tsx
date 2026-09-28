"use client"

import Link from "next/link"
import { ShoppingBag } from "lucide-react"

import { useCartCount } from "@/features/cart/hooks/use-cart"
import { useHydrated } from "@/hooks/use-hydrated"
import { cn } from "@/lib/utils"

/**
 * The count comes from a localStorage-backed store, so it is deliberately not
 * rendered until after mount, otherwise the server HTML (always 0) and the
 * client HTML disagree and React throws a hydration mismatch.
 */
export function CartButton({ className }: { className?: string }) {
  const count = useCartCount()
  const mounted = useHydrated()

  return (
    <Link
      href="/cart"
      // Starts with what is on the button ("Cart 2"), so voice control that
      // is told "click cart 2" finds it; the word after says what 2 counts.
      aria-label={`Cart ${mounted ? count : 0} ${mounted && count === 1 ? "item" : "items"}`}
      className={cn(
        "text-bone flex h-10 items-center gap-2 rounded-full border border-white/[0.14] px-4 font-mono text-xs transition-colors hover:border-white/30",
        className,
      )}
    >
      <ShoppingBag className="size-[15px]" strokeWidth={1.7} />
      <span className="hidden sm:inline">CART</span>{" "}
      <span
        className={cn(
          "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1.5 text-[11px] font-bold",
          mounted && count > 0 ? "bg-blaze text-void" : "text-dim bg-white/10",
        )}
      >
        {mounted ? count : 0}
      </span>
    </Link>
  )
}
