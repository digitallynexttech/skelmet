import Image from "next/image"
import Link from "next/link"

import { Section, SectionHeading } from "@/components/marketing/section"
import { SkullDock } from "@/components/marketing/skull-dock"
import { SectionLabel } from "@/components/shared/section-label"
import { Badge } from "@/components/ui/badge"
import { AddToCartButton } from "@/features/cart/components/add-to-cart-button"
import { FLAME_SKULL_MOUNT, type ColourwayId } from "@/features/catalog/catalog"
import { getProductBySlug } from "@/features/catalog/server/catalog.service"
import { discountPercent, formatMoney } from "@/lib/money"
import { cn } from "@/lib/utils"

/**
 * Each card wears its own colourway - border, hover and add-to-cart button -
 * where only the best seller used to be dressed and the other two sat in
 * neutral grey. The swatch hex is the base; this is the far stop of the
 * button's gradient, which a single swatch cannot give. Blaze runs to ember,
 * exactly as the site's primary button always has.
 */
const TINT_TO: Record<ColourwayId, string> = {
  blaze: "#ff8a00",
  olive: "#aab872",
  ghost: "#edf0f4",
}

export async function ColourwayGrid() {
  const live = await getProductBySlug(FLAME_SKULL_MOUNT.slug)
  const product = live.ok && live.data ? live.data : FLAME_SKULL_MOUNT

  return (
    <Section id="colourways">
      <div className="mb-10 flex flex-col gap-5 sm:mb-12 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <SectionLabel numbered className="mb-3.5">
            The lineup
          </SectionLabel>
          <SectionHeading>Pick your poison</SectionHeading>
        </div>
        <p className="text-ash max-w-[340px] text-[15px] leading-[1.6] lg:pb-2 lg:text-right">
          Same skull, same arm. Three finishes that read completely differently on a wall.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {product.colourways.map((c) => (
          <article
            key={c.id}
            style={{ "--tint": c.hex, "--tint-to": TINT_TO[c.id] } as React.CSSProperties}
            className={cn(
              "rounded-card bg-carbon group relative overflow-hidden border transition-colors",
              // On a phone the whole card fits on one screen under the 75px
              // header, with 12px clear above and below. svh, so it still fits
              // with the browser's toolbars showing. The photo gives up the
              // height; the details under it never shrink.
              "max-sm:flex max-sm:max-h-[calc(100svh-99px)] max-sm:flex-col",
              "border-(--tint)/35 hover:border-(--tint)/60",
            )}
          >
            <Link
              href={`/product/${product.slug}?colour=${c.id}`}
              aria-label={`View ${product.name} in ${c.name}`}
              className="focus-visible:ring-blaze/70 absolute inset-0 z-10 rounded-[inherit] focus-visible:ring-2 focus-visible:outline-none"
            />

            {/* 4:5 on phones is the photos' own shape, so nothing is cropped and
                the skull - and the hero skull that lands on it - sits clear of
                the edges. 4:3 there cut through the crown and the jaw. On a
                short phone it shrinks toward square to keep the card on one
                screen, which still clears the skull. */}
            <div className="relative aspect-4/5 max-sm:min-h-0 sm:aspect-4/3 lg:aspect-square">
              <Image
                src={c.image}
                alt={`${product.name} in ${c.name}`}
                fill
                sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 92vw"
                className="object-cover"
              />
              {/* The hero skull lands here on its way down the page, and on a
                  phone this is where it stops. The photo's own skull is kept
                  hidden throughout, so the card only ever shows the 3D one.
                  Only the blaze plate has a dock; the others render nothing. */}
              <SkullDock
                src={c.image}
                sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 92vw"
                phone
                hideOwnSkull
              />
              {c.bestSeller ? (
                // Above the hero skull (z-30) when it docks here, as the badge
                // is above the photo - on a phone the skull reaches this
                // corner. Click-through, so the card link under it still works.
                <Badge variant="solid" className="pointer-events-none absolute top-4 left-4 z-[35]">
                  Best seller
                </Badge>
              ) : null}
            </div>

            <div className="border-t border-white/[0.07] p-6 max-sm:shrink-0">
              {/* The colourway is the eyebrow and the product is the heading,
                  matching the section header idiom above. The swatch sits with
                  the colour name because that is what it labels - against the
                  product name it read as decoration. */}
              <div className="mb-2 flex items-center gap-2.5">
                <span
                  className="size-[13px] shrink-0 rounded-full"
                  style={{ backgroundColor: c.hex }}
                />
                <span className="text-ash font-mono text-[11.5px] tracking-[0.22em] uppercase">
                  {c.name}
                </span>
              </div>
              {/* text-balance so the two-line wrap splits evenly rather than
                  leaving one word stranded on the second line. */}
              <h3 className="font-display text-bone mb-2.5 text-[24px] leading-[1.08] tracking-[0.04em] text-balance uppercase sm:text-[26px]">
                {product.name}
              </h3>
              <p className="text-ash mb-5 text-[14.5px] leading-[1.58]">{c.blurb}</p>
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="text-bone font-mono text-[18px] font-bold">
                    {formatMoney(c.price)}
                  </span>
                  <span className="text-dim font-mono text-[13px] line-through">
                    {formatMoney(product.compareAtPrice)}
                  </span>
                  <span className="text-acid font-mono text-[11.5px] tracking-[0.08em]">
                    {discountPercent(product.compareAtPrice, c.price)}% OFF
                  </span>
                </div>
                {/* Lifted above the card-wide link so it adds to the cart
                    instead of navigating away from it. */}
                <div className="relative z-20 shrink-0">
                  <AddToCartButton colourway={c.id} variant="tint" size="sm" />
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </Section>
  )
}
