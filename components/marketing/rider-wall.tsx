import Image from "next/image"

import { Section, SectionHeading } from "@/components/marketing/section"
import { SectionLabel } from "@/components/shared/section-label"
import { siteConfig } from "@/config/site"

/**
 * Our own pictures for now - of the mount in use, one reworked by an image
 * model so the wall is not the same helmet every time
 * (scripts/build-rider-wall.mjs) - and the alt text says so rather than
 * passing them off as customers' walls. Riders' shots go here once people tag
 * us and agree to be featured.
 */
const SHOTS = [
  {
    src: "/product/rider-cream-helmet.jpg",
    alt: "Our mount wearing a cream open-face helmet with brown leather trim, gloves and a riding jacket hanging below",
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
    src: "/product/rider-dark-door.jpg",
    alt: "A helmet on the mount against a dark door, the skull filling the visor",
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
