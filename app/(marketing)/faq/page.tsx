import type { Metadata } from "next"

import { FaqSection } from "@/components/marketing/faq-section"
import { pageMetadata } from "@/components/marketing/page-metadata"
import { Section } from "@/components/marketing/section"
import { TrustStrip } from "@/components/marketing/trust-strip"
import { HeroWatermark } from "@/components/shared/hero-watermark"

export const metadata: Metadata = pageMetadata({
  title: "FAQ",
  description:
    "Fitment, drilling, shipping, returns and payment: the questions we actually get asked.",
  path: "/faq",
})

export default function FaqPage() {
  return (
    <>
      <Section className="overflow-hidden pb-0">
        <HeroWatermark accent="ember">FAQ</HeroWatermark>

        <div className="relative z-10">
          <h1 className="font-display text-bone mb-5 text-[52px] leading-[1.0] uppercase sm:text-[72px] xl:text-[88px]">
            Questions,
            <br />
            answered
          </h1>
          <p className="text-ash max-w-[520px] text-[16px] leading-[1.6] text-pretty sm:text-[17.5px]">
            The ones we actually get asked, from fitment and drilling to delivery, returns and the
            warranty. Not here? Message us and a human replies.
          </p>
        </div>
      </Section>
      <TrustStrip />
      <FaqSection />
    </>
  )
}
