import type { Metadata } from "next"

import { Section } from "@/components/marketing/section"
import { TrustStrip } from "@/components/marketing/trust-strip"
import { TrackForm } from "@/features/orders/components/track-form"
import { HeroWatermark } from "@/components/shared/hero-watermark"
import { SectionLabel } from "@/components/shared/section-label"

export const metadata: Metadata = {
  title: "Track your order",
  description: "Order number and email: no account needed.",
  alternates: { canonical: "/track" },
}

export default function TrackPage() {
  return (
    <>
      <Section className="pb-10">
        {/* The watermark wraps the heading only, not the whole Section: the order
            form below is tall enough that centring against it would drop the mark
            far lower than it sits on every other page. */}
        <div className="relative overflow-hidden">
          <HeroWatermark accent="ember">Track</HeroWatermark>

          <div className="relative z-10">
            <SectionLabel className="mb-4">Track order</SectionLabel>
            <h1 className="font-display text-bone mb-5 text-[48px] leading-[1.0] uppercase sm:text-[68px] xl:text-[80px]">
              Where is it?
            </h1>
            <p className="text-ash max-w-[520px] text-[16px] leading-[1.62] sm:text-[17.5px]">
              Order number and the email you used. No account, no password, no hunting through your
              inbox for a link.
            </p>
          </div>
        </div>

        <div className="mt-10">
          <TrackForm />
        </div>
      </Section>
      <TrustStrip />
    </>
  )
}
