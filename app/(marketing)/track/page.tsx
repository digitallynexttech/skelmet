import type { Metadata } from "next"

import { pageMetadata } from "@/components/marketing/page-metadata"
import { Section } from "@/components/marketing/section"
import { TrustStrip } from "@/components/marketing/trust-strip"
import { TrackForm } from "@/features/orders/components/track-form"
import { HeroWatermark } from "@/components/shared/hero-watermark"

export const metadata: Metadata = pageMetadata({
  title: "Track your order",
  description:
    "Where your SKELMET order has got to, from your order number and email. No account needed.",
  path: "/track",
})

export default function TrackPage() {
  return (
    <>
      <div className="grain relative flex min-h-[360px] flex-col justify-center overflow-hidden border-b border-white/[0.07] px-5 pt-14 pb-12 sm:px-8 xl:px-14">
        <HeroWatermark accent="ember">Track</HeroWatermark>

        <div className="relative z-10">
          <h1 className="font-display text-bone mb-5 text-[48px] leading-[1.0] uppercase sm:text-[68px] xl:text-[80px]">
            Where is it?
          </h1>
          <p className="text-ash max-w-[520px] text-[16px] leading-[1.6] text-pretty sm:text-[17.5px]">
            Order number and the email you used. No account, no password, no hunting through your
            inbox for a link. Just where your mount is right now.
          </p>
        </div>
      </div>

      <Section className="pb-10">
        <div className="max-w-[1020px]">
          <TrackForm />
        </div>
      </Section>
      <TrustStrip />
    </>
  )
}
