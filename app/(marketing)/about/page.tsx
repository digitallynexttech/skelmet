import type { Metadata } from "next"
import { ArrowRight, Ban, Eye, Trash2 } from "lucide-react"

import { Anatomy } from "@/components/marketing/anatomy"
import { RiderWall } from "@/components/marketing/rider-wall"
import { Section, SectionHeading } from "@/components/marketing/section"
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

const NUMBERS = [
  { value: "[N]", label: "Mounts shipped" },
  { value: "[N]", label: "Cities delivered to" },
  { value: "4.9", label: "Average rating" },
  { value: "[N]", label: "Printers running" },
]

const WONT_DO = [
  {
    Icon: Ban,
    title: "Fake urgency",
    body: "No countdown timers that reset when you reload. When we say 12 are left, there are 12 left.",
  },
  {
    Icon: Trash2,
    title: "Throwaway quality",
    body: "If it cracks in normal use, we replace it. A wall mount should outlast the helmet sitting on it.",
  },
  {
    Icon: Eye,
    title: "Selling your data",
    body: "Your address is for the courier. That's the entire list of people who get it.",
  },
]

export default function AboutPage() {
  return (
    <>
      <div className="grain relative overflow-hidden border-b border-white/[0.07] px-5 pt-14 pb-14 sm:px-8 xl:px-14">
        <HeroWatermark>About</HeroWatermark>
        <div className="relative z-10 max-w-[900px]">
          <SectionLabel className="mb-5">About us</SectionLabel>
          <h1 className="font-display text-bone mb-7 text-[52px] leading-[1.0] uppercase sm:text-[76px] xl:text-[104px]">
            We started with
            <br />
            one annoyed
            <br />
            <span className="text-blaze">rider</span>
          </h1>
          <p className="text-ash max-w-[640px] text-[16px] leading-[1.62] text-pretty sm:text-[19px]">
            Every helmet hook on the market was either a bent steel hook that scratched the shell,
            or a plastic blob that looked like it came free with a magazine. So we designed the
            thing we actually wanted on our own wall, printed it, and people kept asking where to
            buy one.
          </p>
        </div>
      </div>

      <dl className="grid grid-cols-2 border-b border-white/[0.07] lg:grid-cols-4">
        {NUMBERS.map((n) => (
          <div
            key={n.label}
            className="border-r border-b border-white/[0.07] px-6 py-9 last:border-r-0 sm:px-10 lg:border-b-0"
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
          Why a skull
        </h2>
        <p className="text-ash mb-5 max-w-[480px] text-[16px] leading-[1.66] text-pretty sm:text-[16.5px]">
          Because a helmet on a shelf is storage, and a helmet on a skull is a statement. The cradle
          shape happens to be the right shape too, a rounded dome supports the shell from inside so
          the padding never takes the weight and the liner gets air all night.
        </p>
        <p className="text-ash max-w-[480px] text-[16px] leading-[1.66] text-pretty sm:text-[16.5px]">
          The flames aren&apos;t decoration either. They&apos;re what gives the print its grip and
          its texture, and they&apos;re why it reads properly from across a room instead of turning
          into an orange lump.
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
          Made here,
          <br />
          not imported
        </h2>
        <p className="text-ash mb-5 max-w-[480px] text-[16px] leading-[1.66] text-pretty sm:text-[16.5px]">
          Every mount comes off our own printers in {siteConfig.city}, hand-checked and packed
          the same week. Nothing sits in a container for three months and nothing arrives with a
          mould seam down the middle of its face.
        </p>
        <p className="text-ash mb-7 max-w-[480px] text-[16px] leading-[1.66] text-pretty sm:text-[16.5px]">
          It also means we can change things fast. Three of the tweaks in the current version came
          straight out of customer emails.
        </p>
        <div className="flex flex-wrap gap-2.5">
          <Badge variant="acid">Hand-finished</Badge>
          <Badge variant="acid">Plastic-free packing</Badge>
        </div>
      </SplitFeature>

      <Anatomy />
      <Texture />
      <TrustStrip />

      <Section>
        <SectionLabel numbered tone="magenta" className="mb-3.5">
          Our line in the sand
        </SectionLabel>
        <SectionHeading className="mb-10">What we won&apos;t do</SectionHeading>
        <div className="grid gap-5 lg:grid-cols-3">
          {WONT_DO.map(({ Icon, title, body }) => (
            <article
              key={title}
              className="rounded-card bg-carbon border border-white/[0.09] p-7 sm:p-8"
            >
              <Icon className="text-blaze mb-6 size-7" strokeWidth={1.6} />
              <h3 className="font-display text-bone mb-3 text-[24px] leading-[1.08] uppercase sm:text-[26px]">
                {title}
              </h3>
              <p className="text-ash text-[15px] leading-[1.6]">{body}</p>
            </article>
          ))}
        </div>
      </Section>

      <RiderWall />

      <section className="grain relative overflow-hidden bg-[linear-gradient(100deg,var(--color-blaze),var(--color-ember)_66%,var(--color-flare))] px-5 py-14 sm:px-8 sm:py-18 xl:px-14">
        <div className="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-display text-void mb-3 text-[38px] leading-[1.0] uppercase sm:text-[52px] xl:text-[60px]">
              Enough about us
            </h2>
            <p className="text-void/80 max-w-[480px] text-[16px] leading-[1.56] sm:text-[17px]">
              Go look at the thing. It&apos;s better in person, and the return window means you can
              find that out risk-free.
            </p>
          </div>
          <ButtonLink
            href={`/product/${FLAME_SKULL_MOUNT.slug}`}
            variant="light"
            size="lg"
            className="bg-void text-bone hover:bg-graphite shrink-0"
          >
            Shop the mount
            <ArrowRight className="size-4" strokeWidth={2.4} />
          </ButtonLink>
        </div>
      </section>
    </>
  )
}
