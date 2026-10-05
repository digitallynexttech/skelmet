import type { Metadata } from "next"

import { pageMetadata } from "@/components/marketing/page-metadata"
import { Reviews } from "@/components/marketing/reviews"
import { RiderWall } from "@/components/marketing/rider-wall"
import { Section } from "@/components/marketing/section"
import { HeroWatermark } from "@/components/shared/hero-watermark"
import { siteConfig } from "@/config/site"

export const metadata: Metadata = pageMetadata({
  title: "Rider wall",
  description: `SKELMET mounts on the wall, helmets on the mounts. Put yours up, tag ${siteConfig.social.instagramHandle} on Instagram, and with your permission we may feature it here.`,
  path: "/riders",
})

export default function RidersPage() {
  return (
    <>
      <Section className="overflow-hidden pb-0">
        <HeroWatermark accent="magenta">Riders</HeroWatermark>

        <div className="relative z-10">
          <h1 className="font-display text-bone mb-5 text-[52px] leading-[1.0] uppercase sm:text-[72px] xl:text-[88px]">
            Mounted
            <br />
            &amp; posted
          </h1>
          <p className="text-ash max-w-[520px] text-[16px] leading-[1.6] text-pretty sm:text-[17.5px]">
            The mount at home on a few walls of ours, for now. Put yours up, tag{" "}
            <a
              href={siteConfig.social.instagram}
              target="_blank"
              rel="noreferrer noopener"
              className="text-magenta underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
            >
              {siteConfig.social.instagramHandle}
            </a>{" "}
            on Instagram, and with your permission we may feature it here.
          </p>
        </div>
      </Section>
      <RiderWall />
      <Reviews />
    </>
  )
}
