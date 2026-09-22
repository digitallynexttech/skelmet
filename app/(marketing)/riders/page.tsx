import type { Metadata } from "next"

import { Reviews } from "@/components/marketing/reviews"
import { RiderWall } from "@/components/marketing/rider-wall"
import { Section } from "@/components/marketing/section"
import { HeroWatermark } from "@/components/shared/hero-watermark"
import { SectionLabel } from "@/components/shared/section-label"

export const metadata: Metadata = {
  title: "Rider wall",
  description: "Mounts in the wild. Tag @skelmet and we'll put you up here.",
  alternates: { canonical: "/riders" },
}

export default function RidersPage() {
  return (
    <>
      <Section className="overflow-hidden pb-0">
        <HeroWatermark accent="magenta">Riders</HeroWatermark>

        <div className="relative z-10">
          <SectionLabel tone="magenta" className="mb-4">
            Rider wall
          </SectionLabel>
          <h1 className="font-display text-bone mb-5 text-[52px] leading-[1.0] uppercase sm:text-[72px] xl:text-[88px]">
            Mounted
            <br />
            &amp; posted
          </h1>
          <p className="text-ash max-w-[540px] text-[16px] leading-[1.62] sm:text-[17.5px]">
            Real walls, real helmets, no studio. Tag <span className="text-magenta">@skelmet</span>{" "}
            and we&apos;ll put you up here, best shot each month gets a free mount.
          </p>
        </div>
      </Section>
      <RiderWall />
      <Reviews />
    </>
  )
}
