import Image from "next/image"

import { Section } from "@/components/marketing/section"
import { SectionLabel } from "@/components/shared/section-label"
import { AddToCartButton } from "@/features/cart/components/add-to-cart-button"
import { FLAME_SKULL_MOUNT } from "@/features/catalog/catalog"
import { BUNDLE_DISCOUNT } from "@/lib/constants"
import { formatMoney } from "@/lib/money"

/**
 * What the pair actually rings up as, rather than a figure typed out beside
 * the button: the cart applies BUNDLE_DISCOUNT at two items, so quoting it by
 * hand meant the headline and the basket could disagree after a price change.
 */
const PAIR_PRICE = Number(FLAME_SKULL_MOUNT.price) * 2 - BUNDLE_DISCOUNT

export function Gifting() {
  return (
    <Section className="bg-carbon border-t border-white/[0.07]">
      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <div>
          <SectionLabel index="13" tone="magenta" className="mb-3.5">
            Gifting
          </SectionLabel>
          <h2 className="font-display text-bone mb-5 text-[40px] leading-[1.0] uppercase sm:text-[50px] xl:text-[60px]">
            Arrives ready
            <br />
            to hand over
          </h2>
          <p className="text-ash mb-8 max-w-[460px] text-[16px] leading-[1.62] text-pretty sm:text-[16.5px]">
            Rigid black box, moulded recycled-pulp tray, screws in a paper envelope. No plastic, and
            no invoice in the box if you tick the gift option at checkout.
          </p>

          <div className="rounded-card border-blaze/40 flex flex-col gap-5 border border-dashed bg-[linear-gradient(120deg,rgb(255_90_31_/_0.08),transparent_62%)] p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7">
            <div>
              <div className="text-acid mb-2 font-mono text-[10.5px] tracking-[0.18em] uppercase">
                Bundle &amp; save
              </div>
              <div className="font-display text-bone text-[30px] leading-[1.04] uppercase sm:text-[34px]">
                Two for {formatMoney(PAIR_PRICE)}
              </div>
            </div>
            <AddToCartButton
              colourway="blaze"
              qty={2}
              label="Add the pair"
              variant="accent"
              size="md"
            />
          </div>
        </div>

        <div className="rounded-card overflow-hidden border border-white/[0.08]">
          <div className="relative aspect-square">
            <Image
              src="/product/packaging.jpg"
              alt="SKELMET packaging: a black box with the skull in a moulded pulp tray"
              fill
              sizes="(min-width: 1024px) 45vw, 92vw"
              className="object-cover"
            />
          </div>
        </div>
      </div>
    </Section>
  )
}
