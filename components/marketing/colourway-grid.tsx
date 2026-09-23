import Image from "next/image"
import Link from "next/link"

import { Section, SectionHeading } from "@/components/marketing/section"
import { SkullDock } from "@/components/marketing/skull-dock"
import { SectionLabel } from "@/components/shared/section-label"
import { Badge } from "@/components/ui/badge"
import { AddToCartButton } from "@/features/cart/components/add-to-cart-button"
import { FLAME_SKULL_MOUNT } from "@/features/catalog/catalog"
import { discountPercent, formatMoney } from "@/lib/money"
import { cn } from "@/lib/utils"

export function ColourwayGrid({ index = "01" }: { index?: string } = {}) {
  const product = FLAME_SKULL_MOUNT

  return (
    <Section id="colourways">
      <div className="mb-10 flex flex-col gap-5 sm:mb-12 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <SectionLabel index={index} className="mb-3.5">
            The lineup
          </SectionLabel>
          <SectionHeading>Pick your poison</SectionHeading>
        </div>
        <p className="text-ash max-w-[340px] text-[15px] leading-[1.6] lg:pb-2 lg:text-right">
          Same skull, same bracket. Three finishes that read completely differently on a wall.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {product.colourways.map((c) => (
          <article
            key={c.id}
            className={cn(
              "rounded-card bg-carbon group relative overflow-hidden border transition-colors",
              c.bestSeller
                ? "border-blaze/35 hover:border-blaze/60"
                : "border-white/[0.09] hover:border-white/25",
            )}
          >
            <Link
              href={`/product/${product.slug}?colour=${c.id}`}
              aria-label={`View ${product.name} in ${c.name}`}
              className="focus-visible:ring-blaze/70 absolute inset-0 z-10 rounded-[inherit] focus-visible:ring-2 focus-visible:outline-none"
            />

            <div className="relative aspect-4/3 lg:aspect-square">
              <Image
                src={c.image}
                alt={`${product.name} in ${c.name}`}
                fill
                sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 92vw"
                className="object-cover"
              />
              {/* The hero skull lands here on its way down the page. Only the
                  blaze plate has a dock; the others render nothing. */}
              <SkullDock
                src={c.image}
                sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 92vw"
              />
              {c.bestSeller ? (
                // Above the hero skull (z-30) when it docks here, as the badge
                // is above the photo — on a phone the skull reaches this
                // corner. Click-through, so the card link under it still works.
                <Badge variant="solid" className="pointer-events-none absolute top-4 left-4 z-[35]">
                  Best seller
                </Badge>
              ) : null}
            </div>

            <div className="border-t border-white/[0.07] p-6">
              {/* The colourway is the eyebrow and the product is the heading,
                  matching the section header idiom above. The swatch sits with
                  the colour name because that is what it labels — against the
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
                    {formatMoney(product.price)}
                  </span>
                  <span className="text-dim font-mono text-[13px] line-through">
                    {formatMoney(product.compareAtPrice)}
                  </span>
                  <span className="text-acid font-mono text-[11.5px] tracking-[0.08em]">
                    {discountPercent(product.compareAtPrice, product.price)}% OFF
                  </span>
                </div>
                {/* Lifted above the card-wide link so it adds to the cart
                    instead of navigating away from it. */}
                <div className="relative z-20 shrink-0">
                  <AddToCartButton
                    colourway={c.id}
                    variant={c.bestSeller ? "primary" : "ghost"}
                    size="sm"
                  />
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </Section>
  )
}
