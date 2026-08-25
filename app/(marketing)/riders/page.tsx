import type { Metadata } from "next"

import { ReferBand } from "@/components/marketing/refer-band"
import { Reviews } from "@/components/marketing/reviews"
import { RiderWall } from "@/components/marketing/rider-wall"
import { Section } from "@/components/marketing/section"
import { SectionLabel } from "@/components/shared/section-label"

export const metadata: Metadata = {
  title: "Rider wall",
  description: "Mounts in the wild. Tag @skelmet and we'll put you up here.",
  alternates: { canonical: "/riders" },
}

export default function RidersPage() {
  return (
    <>
      <Section className="pb-0">
        <SectionLabel tone="magenta" className="mb-4">
          Rider wall
        </SectionLabel>
        <h1 className="mb-5 font-display text-[52px] leading-[1.0] text-bone uppercase sm:text-[72px] xl:text-[88px]">
          Mounted
          <br />
          &amp; posted
        </h1>
        <p className="max-w-[540px] text-[16px] leading-[1.62] text-ash sm:text-[17.5px]">
          Real walls, real helmets, no studio. Tag <span className="text-magenta">@skelmet</span> and
          we&apos;ll put you up here, best shot each month gets a free mount.
        </p>
      </Section>
      <RiderWall />
      <Reviews />
      <ReferBand />
    </>
  )
}
