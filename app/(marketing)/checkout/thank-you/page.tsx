import type { Metadata } from "next"
import Image from "next/image"
import { Check, Home, MapPin, Package, Truck } from "lucide-react"

import { ReferBand } from "@/components/marketing/refer-band"
import { Section } from "@/components/marketing/section"
import { ButtonLink } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "Order confirmed",
  description: "Your SKELMET mount is on its way.",
  robots: { index: false, follow: false },
}

const TIMELINE = [
  {
    Icon: Check,
    when: "Done · today",
    title: "Order placed",
    body: "Payment cleared and your batch slot is reserved.",
    done: true,
  },
  {
    Icon: Package,
    when: "Next 48 hrs",
    title: "Printed & finished",
    body: "Your skull goes on the bed, gets cleaned up and packed by hand.",
    done: false,
  },
  {
    Icon: Truck,
    when: "Day 3",
    title: "Out for delivery",
    body: "Tracking link lands in your inbox and on WhatsApp.",
    done: false,
  },
  {
    Icon: Home,
    when: "Fri, 3 Sep",
    title: "On your wall",
    body: "Ten minutes with a drill and the floor is free again.",
    done: false,
  },
]

/**
 * Sample order values: replaced by the real order once the checkout service
 * and payment webhook are wired up.
 */
const ORDER = {
  number: "SKM-2026-0412",
  eta: "FRI, 3 SEP",
  total: "₹4,198",
  email: "rohan.m@example.com",
}

export default function ThankYouPage() {
  return (
    <>
      <div className="grain relative overflow-hidden px-5 py-14 text-center sm:px-8 sm:py-18">
        <div className="absolute top-16 left-1/2 size-[280px] -translate-x-1/2 animate-bloom rounded-full bg-[radial-gradient(circle,rgb(255_90_31_/_0.34),transparent_66%)] blur-[30px] sm:size-[420px]" />
        <div className="absolute top-20 left-1/2 size-[260px] -translate-x-1/2 animate-spin-rev rounded-full border border-dashed border-blaze/30 sm:size-[388px]" />

        <div className="relative z-10 flex flex-col items-center">
          <div className="relative mb-8 aspect-square w-[180px] sm:w-[240px]">
            <Image
              src="/product/hero-skull.jpg"
              alt="Your SKELMET mount is on the way"
              fill
              priority
              sizes="240px"
              className="screen animate-drift object-cover"
            />
          </div>

          <div className="mb-5 flex items-center gap-2.5 font-mono text-[11px] tracking-[0.2em] text-acid uppercase sm:text-[11.5px]">
            <Check className="size-4" strokeWidth={2.6} />
            Payment confirmed
          </div>

          <h1 className="mb-5 font-display text-[62px] leading-[1.0] text-bone uppercase sm:text-[84px] xl:text-[96px]">
            You&apos;re
            <br />
            <span className="text-blaze">mounted</span>
          </h1>

          <p className="mb-8 max-w-[520px] text-[15.5px] leading-[1.6] text-ash text-pretty sm:text-[17.5px]">
            Order&apos;s in and the printers are already warm. We&apos;ve sent the confirmation to{" "}
            <span className="text-bone">{ORDER.email}</span>, check spam if it&apos;s shy.
          </p>

          <dl className="flex w-full max-w-[560px] flex-col overflow-hidden rounded-tile border border-dashed border-white/20 bg-carbon/70 sm:flex-row">
            <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4 sm:flex-1 sm:flex-col sm:items-start sm:gap-1.5 sm:border-r sm:border-b-0">
              <dt className="font-mono text-[9.5px] tracking-[0.16em] text-dim uppercase">
                Order number
              </dt>
              <dd className="font-display leading-[1.12] text-[20px] tracking-[0.06em] text-bone">
                {ORDER.number}
              </dd>
            </div>
            <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4 sm:flex-1 sm:flex-col sm:items-start sm:gap-1.5 sm:border-r sm:border-b-0">
              <dt className="font-mono text-[9.5px] tracking-[0.16em] text-dim uppercase">
                Arrives by
              </dt>
              <dd className="font-display leading-[1.12] text-[20px] tracking-[0.04em] text-acid">{ORDER.eta}</dd>
            </div>
            <div className="flex items-center justify-between px-5 py-4 sm:flex-1 sm:flex-col sm:items-start sm:gap-1.5">
              <dt className="font-mono text-[9.5px] tracking-[0.16em] text-dim uppercase">
                Total paid
              </dt>
              <dd className="font-display leading-[1.12] text-[20px] text-bone">{ORDER.total}</dd>
            </div>
          </dl>
        </div>
      </div>

      <Section className="border-y border-white/[0.07] bg-carbon">
        <h2 className="mb-10 font-display leading-[1.04] text-[34px] text-bone uppercase sm:text-[44px]">
          What happens next
        </h2>

        <ol className="flex flex-col gap-0 lg:grid lg:grid-cols-4 lg:gap-6">
          {TIMELINE.map((step, i) => (
            <li key={step.title} className="flex gap-4 lg:flex-col lg:gap-0">
              <div className="flex flex-col items-center lg:flex-row lg:w-full">
                <span
                  className={
                    step.done
                      ? "flex size-10 shrink-0 items-center justify-center rounded-full bg-blaze lg:size-11"
                      : "flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-white/[0.16] bg-carbon lg:size-11"
                  }
                >
                  <step.Icon
                    className={step.done ? "size-[18px] text-void" : "size-[18px] text-ash"}
                    strokeWidth={step.done ? 2.6 : 1.8}
                  />
                </span>
                {i < TIMELINE.length - 1 ? (
                  <span className="my-1.5 w-0.5 flex-1 bg-white/12 lg:my-0 lg:ml-3 lg:h-0.5 lg:w-full lg:flex-none" />
                ) : null}
              </div>
              <div className="pb-7 lg:pt-5 lg:pb-0">
                <div
                  className={
                    step.done
                      ? "mb-1.5 font-mono text-[9.5px] tracking-[0.14em] text-acid uppercase"
                      : "mb-1.5 font-mono text-[9.5px] tracking-[0.14em] text-dim uppercase"
                  }
                >
                  {step.when}
                </div>
                <h3 className="mb-1.5 text-base font-bold text-bone">{step.title}</h3>
                <p className="max-w-[240px] text-[13.5px] leading-[1.52] text-ash">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <ButtonLink href="/track" variant="light" size="md">
            <MapPin className="size-4" strokeWidth={2.2} />
            Track this order
          </ButtonLink>
          <ButtonLink href="/product/flame-skull-mount#install" variant="ghost" size="md">
            Read the install guide
          </ButtonLink>
        </div>
      </Section>

      <ReferBand />
    </>
  )
}
