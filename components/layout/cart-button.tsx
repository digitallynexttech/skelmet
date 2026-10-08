"use client"

import { ShoppingBag } from "lucide-react"

import { useCartCount } from "@/features/cart/hooks/use-cart"
import { useCartDrawer } from "@/features/cart/hooks/use-cart-drawer"
import { useHydrated } from "@/hooks/use-hydrated"
import { cn } from "@/lib/utils"

/**
 * Opens the cart drawer. The count lives in localStorage, so it shows 0 until mounted to avoid a
 * hydration mismatch.
 */
export function CartButton({ className }: { className?: string }) {
  const count = useCartCount()
  const mounted = useHydrated()
  const open = useCartDrawer((s) => s.open)
  const show = useCartDrawer((s) => s.show)

  return (
    <button
      type="button"
      onClick={(e) => show(e.currentTarget)}
      aria-haspopup="dialog"
      aria-expanded={open}
      // Starts with the visible text ("Cart 2") so voice control can find it.
      aria-label={`Cart ${mounted ? count : 0} ${mounted && count === 1 ? "item" : "items"}`}
      className={cn(
        "text-bone flex h-10 items-center gap-2 rounded-full border border-white/[0.14] px-4 font-mono text-xs transition-colors hover:border-white/30",
        className,
      )}
    >
      <ShoppingBag className="size-[15px]" strokeWidth={1.7} />
      <span
        className={cn(
          "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1.5 text-[11px] font-bold",
          mounted && count > 0 ? "bg-blaze text-void" : "text-dim bg-white/10",
        )}
      >
        {mounted ? count : 0}
      </span>
    </button>
  )
}
