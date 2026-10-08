"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"

import { SkullDock } from "@/components/marketing/skull-dock"
import { Badge } from "@/components/ui/badge"
import { TINT_TO } from "@/features/catalog/catalog"
import { CardBuy } from "@/features/catalog/components/card-buy"
import { SwatchPicker } from "@/features/catalog/components/swatch-picker"
import type { ShopProduct } from "@/features/catalog/shop"
import { discountPercent, formatMoney } from "@/lib/money"
import { cn } from "@/lib/utils"

const SIZES = "(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 92vw"

/** One product in home's lineup; its dots switch the photo in place. */
export function LineupCard({
  product,
  dock,
}: {
  product: ShopProduct
  /** A photo in skull-docks.json framed exactly as the lead picture: the hero skull lands here. */
  dock?: string
}) {
  const lead = product.colourways[0]!
  const [picked, setPicked] = React.useState(lead.id)
  const colourway = product.colourways.find((c) => c.id === picked) ?? lead
  const off = discountPercent(product.compareAtPrice, colourway.price)

  return (
    <article
      style={{ "--tint": colourway.hex, "--tint-to": TINT_TO[colourway.id] } as React.CSSProperties}
      className={cn(
        "rounded-card bg-carbon group relative flex flex-col overflow-hidden border transition-colors",
        // Phones: the card fits one screen below the 75px header, 12px clear each
        // side. The photo gives up the height; the details never shrink.
        "max-sm:max-h-[calc(100svh-99px)]",
        "border-(--tint)/35 hover:border-(--tint)/60",
      )}
    >
      <Link
        href={`/product/${product.slug}?colour=${colourway.id}`}
        aria-label={`View the ${product.name} in ${colourway.name}`}
        className="focus-visible:ring-blaze/70 absolute inset-0 z-10 rounded-[inherit] focus-visible:ring-2 focus-visible:outline-none"
      />

      {/* Square keeps the whole skull in both the 4:5 and the square photos. */}
      <div className="relative aspect-4/5 max-sm:min-h-0 sm:aspect-square">
        <Image
          src={lead.image}
          alt={`${product.name} in ${lead.name}`}
          fill
          sizes={SIZES}
          className="object-cover"
        />
        {/* Where the hero skull docks. It stays put whatever is picked, so the skull's route
            never changes under it. */}
        {dock ? <SkullDock src={dock} sizes={SIZES} phone hideOwnSkull /> : null}
        {colourway.id !== lead.id ? (
          // Over the docked 3D skull (z-30), which is the lead colour.
          <Image
            src={colourway.image}
            alt={`${product.name} in ${colourway.name}`}
            fill
            sizes={SIZES}
            className="pointer-events-none z-[31] object-cover"
          />
        ) : null}
        {!colourway.inStock ? (
          <Badge
            variant="muted"
            className="bg-void/80 pointer-events-none absolute top-4 left-4 z-[35] backdrop-blur-sm"
          >
            Sold out
          </Badge>
        ) : lead.bestSeller ? (
          // "The original", not "Best seller": the shop cannot back a sales ranking yet.
          <Badge variant="solid" className="pointer-events-none absolute top-4 left-4 z-[35]">
            The original
          </Badge>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col border-t border-white/[0.07] p-6 max-sm:shrink-0">
        <SwatchPicker
          colourways={product.colourways}
          picked={colourway.id}
          onPick={setPicked}
          className="mb-3.5"
        />
        <h3 className="font-display text-bone mb-2.5 text-[24px] leading-[1.08] tracking-[0.04em] text-balance uppercase sm:text-[26px]">
          {product.name}
        </h3>
        <p className="text-ash mb-5 line-clamp-2 min-h-[2lh] text-[14.5px] leading-[1.58]">
          {product.summary}
        </p>
        <div className="mt-auto flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-bone font-mono text-[18px] font-bold">
              {formatMoney(colourway.price)}
            </span>
            {off > 0 ? (
              <>
                <span className="text-dim font-mono text-[13px] line-through">
                  {formatMoney(product.compareAtPrice)}
                </span>
                <span className="text-acid font-mono text-[11.5px] tracking-[0.08em]">
                  {off}% OFF
                </span>
              </>
            ) : null}
          </div>
          <CardBuy productSlug={product.slug} colourway={colourway} />
        </div>
      </div>
    </article>
  )
}
