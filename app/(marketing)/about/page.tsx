import type { Metadata } from "next"
import { ArrowRight } from "lucide-react"

import { Anatomy } from "@/components/marketing/anatomy"
import { RiderWall } from "@/components/marketing/rider-wall"
import { SplitFeature } from "@/components/marketing/split-feature"
import { Texture } from "@/components/marketing/texture"
import { TrustStrip } from "@/components/marketing/trust-strip"
import { HeroWatermark } from "@/components/shared/hero-watermark"
import { SectionLabel } from "@/components/shared/section-label"
import { Badge } from "@/components/ui/badge"
import { ButtonLink } from "@/components/ui/button"
import { siteConfig } from "@/config/site"
import { FLAME_SKULL_MOUNT } from "@/features/catalog/catalog"

export const metadata: Metadata = {
  title: "About us",
  description:
    "We started with one annoyed rider and a 3D printer. Here's why the mount looks the way it does.",
  alternates: { canonical: "/about" },
}

/**
 * Four things that are true on the day the shop opens.
 *
 * This used to read "Mounts shipped [N]" and "Cities delivered to [N]".
 * Both are counts of a track record, and filling them in with a figure
 * nobody has earned yet would be a claim a customer cannot check. They
 * are spec instead, which needs no volume to be impressive and no edit to
 * stay honest. Swap the counts back in once they are worth printing.
 */
const NUMBERS = [
  { value: "10 kg", label: "Load rated" },
  { value: siteConfig.promise.deliveryDays.replace(" working days", ""), label: "Working days to deliver" },
  { value: "4.9", label: "Average rating" },
]

export default function AboutPage() {
  return (
    <>
      <div className="grain relative overflow-hidden border-b border-white/[0.07] px-5 pt-14 pb-14 sm:px-8 xl:px-14">
        <HeroWatermark>About</HeroWatermark>
        <div className="relative z-10 max-w-[900px]">
          <SectionLabel className="mb-5">About us</SectionLabel>
          <h1 className="font-display text-bone mb-7 text-[52px] leading-[1.0] uppercase sm:text-[76px] xl:text-[104px]">
            All your gear
            <br />
            <span className="text-blaze">One place</span>
          </h1>
          <p className="text-ash mb-5 max-w-[640px] text-[16px] leading-[1.62] text-pretty sm:text-[19px]">
            Every ride ended the same way. The helmet went on a chair, the floor, or wherever there
            was space, waiting to get knocked over and scratched. The gloves ended up on the shoe
            rack, the jacket over a chair, and the keys wherever they landed. Then the next ride
            started with hunting for all of it again.
          </p>
          <p className="text-ash max-w-[640px] text-[16px] leading-[1.62] text-pretty sm:text-[19px]">
            So we built one place for everything. SKELMET holds your helmet, gloves, jacket and keys
            on a single wall mount, so your gear stays together, stays safe, and is ready when you
            are.
          </p>
        </div>
      </div>

      {/* Three across from sm up, stacked below it. Two columns would leave
          the third tile orphaned beside an empty cell, and three columns on a
          phone gives "Working days to deliver" about 90px to wrap into. */}
      <dl className="grid grid-cols-1 border-b border-white/[0.07] sm:grid-cols-3">
        {NUMBERS.map((n) => (
          <div
            key={n.label}
            className="border-b border-white/[0.07] px-6 py-9 last:border-b-0 sm:border-r sm:border-b-0 sm:px-10 sm:last:border-r-0"
          >
            <dd className="font-display text-blaze mb-2.5 text-[42px] leading-none sm:text-[58px]">
              {n.value}
            </dd>
            <dt className="text-ash font-mono text-[10.5px] tracking-[0.18em] uppercase sm:text-[11px]">
              {n.label}
            </dt>
          </div>
        ))}
      </dl>

      <SplitFeature
        image="/product/lifestyle-room.jpg"
        alt="A SKELMET mount holding a helmet in a rider's room"
      >
        <SectionLabel numbered className="mb-4">
          The design
        </SectionLabel>
        <h2 className="font-display text-bone mb-5 text-[36px] leading-[1.04] uppercase sm:text-[46px] xl:text-[52px]">
          Built to hold
          <br />
          Made to stand out
        </h2>
        <p className="text-ash mb-5 max-w-[480px] text-[16px] leading-[1.66] text-pretty sm:text-[16.5px]">
          The shape is built around the inside of your helmet. It spreads the weight evenly, so no
          single spot of the padding gets pressed out of shape, and it keeps the helmet open so the
          liner can dry out between rides.
        </p>
        <p className="text-ash max-w-[480px] text-[16px] leading-[1.66] text-pretty sm:text-[16.5px]">
          And it doesn&apos;t look like a piece of furniture you bolted to the wall. It looks like a
          piece of art, the kind people notice from across the room and can&apos;t stop looking at.
        </p>
      </SplitFeature>

      <SplitFeature
        image="/product/colourway-lineup.jpg"
        alt="Three SKELMET colourways fresh off the print bed"
        reverse
      >
        <SectionLabel numbered tone="acid" className="mb-4">
          The making
        </SectionLabel>
        <h2 className="font-display text-bone mb-5 text-[36px] leading-[1.04] uppercase sm:text-[46px] xl:text-[52px]">
          Made by riders,
          <br />
          for riders
        </h2>
        <p className="text-ash mb-5 max-w-[480px] text-[16px] leading-[1.66] text-pretty sm:text-[16.5px]">
          You clean your chain after the rain. You check the tyre pressure before a long ride.
          You&apos;ve spent more hours picking the right helmet than most people spend picking a
          phone.
        </p>
        <p className="text-ash mb-7 max-w-[480px] text-[16px] leading-[1.66] text-pretty sm:text-[16.5px]">
          That is the rider&apos;s spirit. Riding isn&apos;t just how we get somewhere. It&apos;s
          who we are. So the gear that protects us deserves more than a corner of the room. It
          deserves a place that respects it, the way you respect every ride.
        </p>
        <div className="flex flex-wrap gap-2.5">
          <Badge variant="acid">Hand-finished</Badge>
          <Badge variant="acid">Plastic-free packing</Badge>
        </div>
      </SplitFeature>

      <Anatomy />
      <Texture />
      <TrustStrip />

      <RiderWall />

      <section className="grain relative overflow-hidden bg-[linear-gradient(100deg,var(--color-blaze),var(--color-ember)_66%,var(--color-flare))] px-5 py-14 sm:px-8 sm:py-18 xl:px-14">
        <div className="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-display text-void mb-3 text-[38px] leading-[1.0] uppercase sm:text-[52px] xl:text-[60px]">
              Enough about us
            </h2>
            <p className="text-void/80 max-w-[480px] text-[16px] leading-[1.56] text-pretty sm:text-[17px]">
              Get the throne of your riding gear. It looks much better in person.
            </p>
          </div>
          <ButtonLink
            href={`/product/${FLAME_SKULL_MOUNT.slug}`}
            variant="light"
            size="lg"
            className="bg-void text-bone hover:bg-graphite shrink-0"
          >
            Get yours
            <ArrowRight className="size-4" strokeWidth={2.4} />
          </ButtonLink>
        </div>
      </section>
    </>
  )
}
