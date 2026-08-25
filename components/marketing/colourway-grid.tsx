import Image from "next/image"

import { Section, SectionHeading } from "@/components/marketing/section"
import { SectionLabel } from "@/components/shared/section-label"
import { Badge } from "@/components/ui/badge"
import { AddToCartButton } from "@/features/cart/components/add-to-cart-button"
import { FLAME_SKULL_MOUNT } from "@/features/catalog/catalog"
import { formatMoney } from "@/lib/money"
import { cn } from "@/lib/utils"

export function ColourwayGrid() {
  const product = FLAME_SKULL_MOUNT

  return (
    <Section id="colourways">
      <div className="mb-10 flex flex-col gap-5 sm:mb-12 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <SectionLabel index="01" className="mb-3.5">
            The lineup
          </SectionLabel>
          <SectionHeading>Pick your poison</SectionHeading>
        </div>
        <p className="max-w-[340px] text-[15px] leading-[1.6] text-ash lg:pb-2 lg:text-right">
          Same skull, same bracket. Three finishes that read completely differently on a wall.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {product.colourways.map((c) => (
          <article
            key={c.id}
            className={cn(
              "overflow-hidden rounded-card border bg-carbon",
              c.bestSeller ? "border-blaze/35" : "border-white/[0.09]",
            )}
          >
            <div className="relative aspect-4/3 lg:aspect-square">
              <Image
                src={c.image}
                alt={`${c.name} SKELMET mount`}
                fill
                sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 92vw"
                className="object-cover"
              />
              {c.bestSeller ? (
                <Badge variant="solid" className="absolute top-4 left-4">
                  Best seller
                </Badge>
              ) : null}
            </div>

            <div className="border-t border-white/[0.07] p-6">
              <div className="mb-2.5 flex items-center gap-2.5">
                <span
                  className="size-[15px] shrink-0 rounded-full"
                  style={{ backgroundColor: c.hex }}
                />
                <h3 className="font-display leading-[1.08] text-[24px] tracking-[0.04em] text-bone uppercase sm:text-[26px]">
                  {c.name}
                </h3>
              </div>
              <p className="mb-5 text-[14.5px] leading-[1.58] text-ash">{c.blurb}</p>
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-[18px] font-bold text-bone">
                  {formatMoney(product.price)}
                </span>
                <AddToCartButton
                  colourway={c.id}
                  variant={c.bestSeller ? "primary" : "ghost"}
                  size="sm"
                />
              </div>
            </div>
          </article>
        ))}
      </div>
    </Section>
  )
}
