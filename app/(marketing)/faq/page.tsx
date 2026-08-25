import type { Metadata } from "next"

import { FaqSection } from "@/components/marketing/faq-section"
import { Section } from "@/components/marketing/section"
import { TrustStrip } from "@/components/marketing/trust-strip"
import { SectionLabel } from "@/components/shared/section-label"

export const metadata: Metadata = {
  title: "FAQ",
  description: "Fitment, drilling, shipping and returns, the questions we actually get asked.",
  alternates: { canonical: "/faq" },
}

export default function FaqPage() {
  return (
    <>
      <Section className="pb-0">
        <SectionLabel className="mb-4">Support</SectionLabel>
        <h1 className="mb-5 font-display text-[52px] leading-[1.0] text-bone uppercase sm:text-[72px] xl:text-[88px]">
          Questions,
          <br />
          answered
        </h1>
        <p className="max-w-[540px] text-[16px] leading-[1.62] text-ash sm:text-[17.5px]">
          The ones we actually get asked, in the order we get asked them.
        </p>
      </Section>
      <TrustStrip />
      <FaqSection />
    </>
  )
}
