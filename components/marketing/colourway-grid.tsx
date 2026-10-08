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

/** Far stop of each card's button gradient; the swatch hex is the near one. */
const TINT_TO: Record<ColourwayId, string> = {
  blaze: "#ff8a00",
  olive: "#aab872",
  ghost: "#bebdc4",
}

export async function ColourwayGrid() {
  // Registry figures if the live read fails: priced cards beat a broken home page.
  const product = await getProductBySlug(FLAME_SKULL_MOUNT.slug).then(
    (live) => (live.ok && live.data ? live.data : FLAME_SKULL_MOUNT),
    () => FLAME_SKULL_MOUNT,
  )

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
          One face, three moods. Pick the colour that speaks to you.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {product.colourways.map((c) => (
          <article
            key={c.id}
            style={{ "--tint": c.hex, "--tint-to": TINT_TO[c.id] } as React.CSSProperties}
            className={cn(
              "rounded-card bg-carbon group relative overflow-hidden border transition-colors",
              // Phones: the card fits one screen below the 75px header, 12px clear each
              // side. The photo gives up the height; the details never shrink.
              "max-sm:flex max-sm:max-h-[calc(100svh-99px)] max-sm:flex-col",
              "border-(--tint)/35 hover:border-(--tint)/60",
            )}
          >
            <Link
              href={`/product/${product.slug}?colour=${c.id}`}
              aria-label={`View ${product.name} in ${c.name}`}
              className="focus-visible:ring-blaze/70 absolute inset-0 z-10 rounded-[inherit] focus-visible:ring-2 focus-visible:outline-none"
            />

            {/* 4:5 on phones is the photos' own shape, so the skull is never cropped. */}
            <div className="relative aspect-4/5 max-sm:min-h-0 sm:aspect-4/3 lg:aspect-square">
              <Image
                src={c.image}
                alt={`${product.name} in ${c.name}`}
                fill
                sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 92vw"
                className="object-cover"
              />
              {/* Where the hero skull docks; the photo's own skull stays hidden. Only the
                  blaze card has a dock. */}
              <SkullDock
                src={c.image}
                sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 92vw"
                phone
                hideOwnSkull
              />
              {c.bestSeller ? (
                // Above the docked skull (z-30); click-through so the card link works.
                // "The original", not "Best seller": the shop cannot back a sales ranking yet.
                <Badge variant="solid" className="pointer-events-none absolute top-4 left-4 z-[35]">
                  The original
                </Badge>
              ) : null}
            </div>

            <div className="border-t border-white/[0.07] p-6 max-sm:shrink-0">
              <div className="mb-2 flex items-center gap-2.5">
                <span
                  className="size-[13px] shrink-0 rounded-full"
                  style={{ backgroundColor: c.hex }}
                />
                <span className="text-ash font-mono text-[11.5px] tracking-[0.22em] uppercase">
                  {c.name}
                </span>
              </div>
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
                {/* Above the card-wide link, so it adds to cart instead of navigating. */}
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
