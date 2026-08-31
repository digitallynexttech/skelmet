import type { Metadata } from "next"

import { ColourwayGrid } from "@/components/marketing/colourway-grid"
import { Comparison } from "@/components/marketing/comparison"
import { FaqSection } from "@/components/marketing/faq-section"
import { Gifting } from "@/components/marketing/gifting"
import { Reviews } from "@/components/marketing/reviews"
import { Section } from "@/components/marketing/section"
import { TrustStrip } from "@/components/marketing/trust-strip"
import { HeroWatermark } from "@/components/shared/hero-watermark"
import { SectionLabel } from "@/components/shared/section-label"

export const metadata: Metadata = {
  title: "Shop",
  description: "Every SKELMET colourway, in stock and printed to order.",
  alternates: { canonical: "/shop" },
}

export default function ShopPage() {
  return (
    <>
      <Section className="overflow-hidden pb-0">
        <HeroWatermark accent="ember">Shop</HeroWatermark>

        <div className="relative z-10">
          <SectionLabel className="mb-4">The collection</SectionLabel>
          <h1 className="mb-5 font-display text-[52px] leading-[1.0] text-bone uppercase sm:text-[72px] xl:text-[88px]">
            One mount.
            <br />
            Three moods.
          </h1>
          <p className="max-w-[540px] text-[16px] leading-[1.62] text-ash sm:text-[17.5px]">
            We make exactly one thing and we make it properly. Pick the filament that suits your wall.
          </p>
        </div>
      </Section>
      <ColourwayGrid />
      <TrustStrip />
      <Comparison />
      <Reviews />
      <Gifting />
      <FaqSection />
    </>
  )
}
