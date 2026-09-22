import type { Metadata } from "next"
import Image from "next/image"
import { Check, Home, MapPin, Package, Truck } from "lucide-react"

import { Section } from "@/components/marketing/section"
import { ButtonLink } from "@/components/ui/button"
import { FLAME_SKULL_MOUNT } from "@/features/catalog/catalog"
import { BUNDLE_DISCOUNT } from "@/lib/constants"
import { formatMoney } from "@/lib/money"

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
  total: formatMoney(Number(FLAME_SKULL_MOUNT.price) * 3 - BUNDLE_DISCOUNT),
  email: "rohan.m@example.com",
}

export default function ThankYouPage() {
  return (
    <>
      <div className="grain relative overflow-hidden px-5 py-14 text-center sm:px-8 sm:py-18">
        <div className="animate-bloom absolute top-16 left-1/2 size-[280px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgb(255_90_31_/_0.34),transparent_66%)] blur-[30px] sm:size-[420px]" />
        <div className="animate-spin-rev border-blaze/30 absolute top-20 left-1/2 size-[260px] -translate-x-1/2 rounded-full border border-dashed sm:size-[388px]" />

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

          <div className="text-acid mb-5 flex items-center gap-2.5 font-mono text-[11px] tracking-[0.2em] uppercase sm:text-[11.5px]">
            <Check className="size-4" strokeWidth={2.6} />
            Payment confirmed
          </div>

          <h1 className="font-display text-bone mb-5 text-[62px] leading-[1.0] uppercase sm:text-[84px] xl:text-[96px]">
            You&apos;re
            <br />
            <span className="text-blaze">mounted</span>
          </h1>

          <p className="text-ash mb-8 max-w-[520px] text-[15.5px] leading-[1.6] text-pretty sm:text-[17.5px]">
            Order&apos;s in and the printers are already warm. We&apos;ve sent the confirmation to{" "}
            <span className="text-bone">{ORDER.email}</span>, check spam if it&apos;s shy.
          </p>

          <dl className="rounded-tile bg-carbon/70 flex w-full max-w-[560px] flex-col overflow-hidden border border-dashed border-white/20 sm:flex-row">
            <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4 sm:flex-1 sm:flex-col sm:items-start sm:gap-1.5 sm:border-r sm:border-b-0">
              <dt className="text-dim font-mono text-[9.5px] tracking-[0.16em] uppercase">
                Order number
              </dt>
              <dd className="font-display text-bone text-[20px] leading-[1.12] tracking-[0.06em]">
                {ORDER.number}
              </dd>
            </div>
            <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4 sm:flex-1 sm:flex-col sm:items-start sm:gap-1.5 sm:border-r sm:border-b-0">
              <dt className="text-dim font-mono text-[9.5px] tracking-[0.16em] uppercase">
                Arrives by
              </dt>
              <dd className="font-display text-acid text-[20px] leading-[1.12] tracking-[0.04em]">
                {ORDER.eta}
              </dd>
            </div>
            <div className="flex items-center justify-between px-5 py-4 sm:flex-1 sm:flex-col sm:items-start sm:gap-1.5">
              <dt className="text-dim font-mono text-[9.5px] tracking-[0.16em] uppercase">
                Total paid
              </dt>
              <dd className="font-display text-bone text-[20px] leading-[1.12]">{ORDER.total}</dd>
            </div>
          </dl>
        </div>
      </div>

      <Section className="bg-carbon border-y border-white/[0.07]">
        <h2 className="font-display text-bone mb-10 text-[34px] leading-[1.04] uppercase sm:text-[44px]">
          What happens next
        </h2>

        <ol className="flex flex-col gap-0 lg:grid lg:grid-cols-4 lg:gap-6">
          {TIMELINE.map((step, i) => (
            <li key={step.title} className="flex gap-4 lg:flex-col lg:gap-0">
              <div className="flex flex-col items-center lg:w-full lg:flex-row">
                <span
                  className={
                    step.done
                      ? "bg-blaze flex size-10 shrink-0 items-center justify-center rounded-full lg:size-11"
                      : "bg-carbon flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-white/[0.16] lg:size-11"
                  }
                >
                  <step.Icon
                    className={step.done ? "text-void size-[18px]" : "text-ash size-[18px]"}
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
                      ? "text-acid mb-1.5 font-mono text-[9.5px] tracking-[0.14em] uppercase"
                      : "text-dim mb-1.5 font-mono text-[9.5px] tracking-[0.14em] uppercase"
                  }
                >
                  {step.when}
                </div>
                <h3 className="text-bone mb-1.5 text-base font-bold">{step.title}</h3>
                <p className="text-ash max-w-[240px] text-[13.5px] leading-[1.52]">{step.body}</p>
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
    </>
  )
}
