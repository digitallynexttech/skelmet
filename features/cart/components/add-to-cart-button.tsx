"use client"

import * as React from "react"
import { Check, ShoppingBag } from "lucide-react"

import { Button, type ButtonProps } from "@/components/ui/button"
import { useCart } from "@/features/cart/hooks/use-cart"
import { useCartDrawer } from "@/features/cart/hooks/use-cart-drawer"
import type { ColourwayId } from "@/features/catalog/catalog"

type Props = Omit<ButtonProps, "onClick" | "children"> & {
  colourway: ColourwayId
  /** The Flame Skull unless named. */
  productSlug?: string
  qty?: number
  label?: string
  showIcon?: boolean
}

export function AddToCartButton({
  colourway,
  productSlug,
  qty = 1,
  label = "Add to cart",
  showIcon = false,
  ...props
}: Props) {
  const add = useCart((s) => s.add)
  const showCart = useCartDrawer((s) => s.show)
  const [justAdded, setJustAdded] = React.useState(false)
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  function handleAdd(e: React.MouseEvent<HTMLButtonElement>) {
    add(colourway, qty, productSlug)
    setJustAdded(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setJustAdded(false), 1800)
    showCart(e.currentTarget)
  }

  return (
    <Button type="button" onClick={handleAdd} {...props}>
      {justAdded ? (
        <>
          <Check className="size-4" strokeWidth={2.6} />
          Added
        </>
      ) : (
        <>
          {showIcon ? <ShoppingBag className="size-4" strokeWidth={1.9} /> : null}
          {label}
        </>
      )}
    </Button>
  )
}
