import type { Metadata } from "next"
import { Check, Home, MapPin, Truck } from "lucide-react"

import { Section } from "@/components/marketing/section"
import { SkullStage } from "@/components/marketing/skull-stage"
import { ButtonLink } from "@/components/ui/button"
import { getConfirmation, type Confirmation } from "@/features/checkout/server/checkout.service"
import { formatMoney } from "@/lib/money"

export const metadata: Metadata = {
  title: "Order confirmed",
  description: "Your SKELMET mount is on its way.",
  robots: { index: false, follow: false },
}

/**
 * Reads the order it is confirming rather than describing a sample one.
 *
 * It used to render a hardcoded `SKM-2026-0412` for `rohan.m@example.com`,
 * which meant the redirect out of checkout carried a real order number in
 * `?order=` to a page that ignored it and showed every customer the same
 * stranger's details.
 *
 * Authorisation lives in `getConfirmation`, not here: an order number is short
 * enough to guess, so the service only answers for the browser that placed the
 * order or the account that owns it. Anything else is a 404 and lands on the
 * fallback below, which names no one.
 */

const DELIVERY_DAYS = 6

function etaFrom(iso: string): string {
  const placed = new Date(iso)
  // Date.UTC, not new Date(y, m, d): the server runs UTC and local midnight
  // would shift the date by a day for anyone east or west of it (§6).
  const eta = new Date(
    Date.UTC(placed.getUTCFullYear(), placed.getUTCMonth(), placed.getUTCDate() + DELIVERY_DAYS),
  )
  return eta
    .toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    })
    .toUpperCase()
}

function timelineFor(order: Confirmation) {
  const paid = order.status !== "PENDING"
  return [
    {
      Icon: Check,
      when: paid ? "Done · today" : "Done · today",
      title: "Order placed",
      body: paid
        ? "Payment cleared and your mount is reserved."
        : "Your mount is reserved. You pay the courier on delivery.",
      done: true,
    },
    {
      Icon: Truck,
      when: "Day 3",
      title: "Out for delivery",
      body: "Tracking link lands in your inbox and on WhatsApp.",
      done: order.status === "SHIPPED" || order.status === "DELIVERED",
    },
    {
      Icon: Home,
      when: etaFrom(order.placedAt ?? new Date().toISOString()),
      title: "On your wall",
      body: "Ten minutes with a drill and the floor is free again.",
      done: order.status === "DELIVERED",
    },
  ]
}

/** Shown when there is no order to confirm. Deliberately names nobody. */
function Unknown() {
  return (
    <div className="grain relative overflow-hidden px-5 py-20 text-center sm:px-8 sm:py-28">
      <div className="relative z-10 mx-auto flex max-w-[520px] flex-col items-center">
        <h1 className="font-display text-bone mb-5 text-[44px] leading-[1.02] uppercase sm:text-[60px]">
          Nothing to show
        </h1>
        <p className="text-ash mb-9 text-[15.5px] leading-[1.6] text-pretty sm:text-[17px]">
          We can&apos;t find an order for this browser. If you&apos;ve just paid, the confirmation
          is in your inbox — look it up with your order number and we&apos;ll pull up the status.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <ButtonLink href="/track" variant="light" size="md">
            <MapPin className="size-4" strokeWidth={2.2} />
            Track an order
          </ButtonLink>
          <ButtonLink href="/product/flame-skull-mount" variant="ghost" size="md">
            Back to the mount
          </ButtonLink>
        </div>
      </div>
    </div>
  )
}

export default async function ThankYouPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>
}) {
  const { order: requested } = await searchParams
  const result = requested ? await getConfirmation(requested) : null

  if (!result?.ok) return <Unknown />

  const order = result.data
  const paid = order.status !== "PENDING"
  const timeline = timelineFor(order)

  return (
    <>
      <div className="grain relative flex min-h-[calc(100dvh-74px)] flex-col justify-center overflow-hidden px-5 py-10 text-center sm:px-8">
        <div className="animate-bloom absolute top-16 left-1/2 size-[280px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgb(255_90_31_/_0.34),transparent_66%)] blur-[30px] sm:size-[420px]" />
        <div className="animate-spin-rev border-blaze/30 absolute top-20 left-1/2 size-[260px] -translate-x-1/2 rounded-full border border-dashed sm:size-[388px]" />

        <div className="relative z-10 flex flex-col items-center">
          <div className="relative mb-5 aspect-square w-[168px] shrink-0 sm:w-[210px]">
            <SkullStage className="size-full" />
          </div>

          {/* A cash-on-delivery order has not been paid for, and saying it has
              is the kind of small lie a customer notices at the door. */}
          <div className="text-acid mb-4 flex items-center gap-2.5 font-mono text-[11px] tracking-[0.2em] uppercase sm:text-[11.5px]">
            <Check className="size-4" strokeWidth={2.6} />
            {paid ? "Payment confirmed" : "Order confirmed · pay on delivery"}
          </div>

          <h1 className="font-display text-bone mb-4 text-[clamp(34px,13vw,96px)] leading-[1.0] whitespace-nowrap uppercase">
            You&apos;re <span className="text-blaze">mounted</span>
          </h1>

          <p className="text-ash mb-7 max-w-[520px] text-[15px] leading-[1.6] text-pretty sm:text-[16.5px]">
            Order&apos;s in and the printers are already warm. We&apos;ve sent the confirmation to{" "}
            <span className="text-bone">{order.email}</span>, check spam if it&apos;s shy.
          </p>

          <dl className="rounded-tile bg-carbon/70 flex w-full max-w-[560px] flex-col overflow-hidden border border-dashed border-white/20 sm:flex-row">
            <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4 sm:flex-1 sm:flex-col sm:items-start sm:gap-1.5 sm:border-r sm:border-b-0">
              <dt className="text-dim font-mono text-[9.5px] tracking-[0.16em] uppercase">
                Order number
              </dt>
              <dd className="font-display text-bone text-[20px] leading-[1.12] tracking-[0.06em]">
                {order.number}
              </dd>
            </div>
            <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4 sm:flex-1 sm:flex-col sm:items-start sm:gap-1.5 sm:border-r sm:border-b-0">
              <dt className="text-dim font-mono text-[9.5px] tracking-[0.16em] uppercase">
                Arrives by
              </dt>
              <dd className="font-display text-acid text-[20px] leading-[1.12] tracking-[0.04em]">
                {etaFrom(order.placedAt ?? new Date().toISOString())}
              </dd>
            </div>
            <div className="flex items-center justify-between px-5 py-4 sm:flex-1 sm:flex-col sm:items-start sm:gap-1.5">
              <dt className="text-dim font-mono text-[9.5px] tracking-[0.16em] uppercase">
                {paid ? "Total paid" : "Due on delivery"}
              </dt>
              <dd className="font-display text-bone text-[20px] leading-[1.12]">
                {formatMoney(order.total)}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <Section className="bg-carbon border-y border-white/[0.07]">
        <h2 className="font-display text-bone mb-10 text-[34px] leading-[1.04] uppercase sm:text-[44px]">
          What happens next
        </h2>

        <ol className="flex flex-col gap-0 lg:grid lg:grid-cols-4 lg:gap-6">
          {timeline.map((step, i) => (
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
                {i < timeline.length - 1 ? (
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
