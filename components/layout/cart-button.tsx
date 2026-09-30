"use client"

import { ShoppingBag } from "lucide-react"

import { useCartCount } from "@/features/cart/hooks/use-cart"
import { useCartDrawer } from "@/features/cart/hooks/use-cart-drawer"
import { useHydrated } from "@/hooks/use-hydrated"
import { cn } from "@/lib/utils"

/**
 * Opens the cart drawer (features/cart/components/cart-drawer). A button, not
 * a link: the cart is not a page any more. The bag and the count, at every
 * width: the word CART beside them on a desktop was the only difference.
 *
 * The count comes from a localStorage-backed store, so it is deliberately not
 * rendered until after mount, otherwise the server HTML (always 0) and the
 * client HTML disagree and React throws a hydration mismatch.
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
      // Starts with what is on the button ("Cart 2"), so voice control that
      // is told "click cart 2" finds it; the word after says what 2 counts.
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
