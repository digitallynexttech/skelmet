"use client"

import { Button } from "@/components/ui/button"
import { AddToCartButton } from "@/features/cart/components/add-to-cart-button"
import type { Colourway } from "@/features/catalog/catalog"
import { cn } from "@/lib/utils"

/** A product card's button: adds the picked colour, or says it is sold out. Above a card-wide link. */
export function CardBuy({
  productSlug,
  colourway,
  full = false,
}: {
  productSlug: string
  colourway: Colourway
  /** As wide as the card. */
  full?: boolean
}) {
  return (
    <div className={cn("relative z-20", full ? "w-full" : "shrink-0")}>
      {colourway.inStock ? (
        <AddToCartButton
          colourway={colourway.id}
          productSlug={productSlug}
          variant="tint"
          size="sm"
          full={full}
        />
      ) : (
        <Button type="button" variant="ghost" size="sm" full={full} disabled>
          Sold out
        </Button>
      )}
    </div>
  )
}
