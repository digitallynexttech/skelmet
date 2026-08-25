"use client"

import * as React from "react"
import { Check, ShoppingBag } from "lucide-react"
import { toast } from "sonner"

import { Button, type ButtonProps } from "@/components/ui/button"
import { useCart } from "@/features/cart/hooks/use-cart"
import { getColourway, type ColourwayId } from "@/features/catalog/catalog"

type Props = Omit<ButtonProps, "onClick" | "children"> & {
  colourway: ColourwayId
  qty?: number
  label?: string
  showIcon?: boolean
}

export function AddToCartButton({
  colourway,
  qty = 1,
  label = "Add to cart",
  showIcon = false,
  ...props
}: Props) {
  const add = useCart((s) => s.add)
  const [justAdded, setJustAdded] = React.useState(false)
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  function handleAdd() {
    add(colourway, qty)
    setJustAdded(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setJustAdded(false), 1800)

    const name = getColourway(colourway)?.name ?? "Mount"
    toast.success(`${name} added to cart`, {
      description: qty > 1 ? `${qty} × Flame Skull Helmet Mount` : "Flame Skull Helmet Mount",
    })
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
