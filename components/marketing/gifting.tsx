import Image from "next/image"

import { Section } from "@/components/marketing/section"
import { SectionLabel } from "@/components/shared/section-label"
import { AddToCartButton } from "@/features/cart/components/add-to-cart-button"

export function Gifting() {
  return (
    <Section className="border-t border-white/[0.07] bg-carbon">
      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <div>
          <SectionLabel index="13" tone="magenta" className="mb-3.5">
            Gifting
          </SectionLabel>
          <h2 className="mb-5 font-display text-[40px] leading-[1.0] text-bone uppercase sm:text-[50px] xl:text-[60px]">
            Arrives ready
            <br />
            to hand over
          </h2>
          <p className="mb-8 max-w-[460px] text-[16px] leading-[1.62] text-ash text-pretty sm:text-[16.5px]">
            Rigid black box, moulded recycled-pulp tray, screws in a paper envelope. No plastic, and
            no invoice in the box if you tick the gift option at checkout.
          </p>

          <div className="flex flex-col gap-5 rounded-card border border-dashed border-blaze/40 bg-[linear-gradient(120deg,rgb(255_90_31_/_0.08),transparent_62%)] p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7">
            <div>
              <div className="mb-2 font-mono text-[10.5px] tracking-[0.18em] text-acid uppercase">
                Bundle &amp; save
              </div>
              <div className="font-display leading-[1.04] text-[30px] text-bone uppercase sm:text-[34px]">
                Two for &#8377;2,699
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

        <div className="overflow-hidden rounded-card border border-white/[0.08]">
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
