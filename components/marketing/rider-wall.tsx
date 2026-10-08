import Image from "next/image"

import { Section, SectionHeading } from "@/components/marketing/section"
import { SectionLabel } from "@/components/shared/section-label"
import { siteConfig } from "@/lib/config/site"

/**
 * Our own photos until riders tag us and agree to be featured. The alt text says they are
 * ours, never customers'. Recolours: scripts/build-rider-wall.mjs.
 */
const SHOTS = [
  {
    src: "/product/rider-dark-door.jpg",
    alt: "A helmet on the mount against a dark door, the Ghost Grey skull filling the visor",
  },
  {
    src: "/product/rider-bare-skull.jpg",
    alt: "The flame skull on its arm with no helmet, gloves hanging from the hook",
  },
  {
    src: "/product/rider-motorcycle-wall.jpg",
    alt: "A black helmet on our mount over a riding jacket and gloves, a motorcycle parked below",
  },
  {
    src: "/product/rider-cream-helmet-white-wall.jpg",
    alt: "Our mount in Militia Olive wearing a cream open-face helmet with brown leather trim, gloves and a riding jacket hanging below it on a white wall",
  },
]

export function RiderWall() {
  return (
    <Section className="bg-carbon border-t border-white/[0.07]">
      <div className="mb-9 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <SectionLabel numbered tone="magenta" className="mb-3.5">
            Rider wall
          </SectionLabel>
          <SectionHeading>Mounted &amp; posted</SectionHeading>
        </div>
        <a
          href={siteConfig.social.instagram}
          target="_blank"
          rel="noreferrer noopener"
          className="border-magenta/40 text-magenta hover:border-magenta hover:bg-magenta/10 focus-visible:border-magenta focus-visible:bg-magenta/10 inline-flex h-11 items-center rounded-full border px-5 text-[13px] font-semibold tracking-[0.05em] uppercase transition-colors focus-visible:outline-none"
        >
          Tag {siteConfig.social.instagramHandle} to be featured
        </a>
      </div>

      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {SHOTS.map((shot) => (
          <div
            key={shot.src}
            className="rounded-tile relative aspect-square overflow-hidden border border-white/[0.08]"
          >
            <Image
              src={shot.src}
              alt={shot.alt}
              fill
              sizes="(min-width: 1024px) 24vw, 45vw"
              className="object-cover"
            />
          </div>
        ))}
      </div>
    </Section>
  )
}
