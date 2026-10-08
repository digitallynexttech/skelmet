import type { Metadata } from "next"
import { ArrowRight, Check, Clock, Home, MapPin, Truck } from "lucide-react"

import { Section } from "@/components/marketing/section"
import { SkullStage } from "@/components/marketing/skull-stage"
import { ButtonLink } from "@/components/ui/button"
import { siteConfig } from "@/config/site"
import { getConfirmation, type Confirmation } from "@/features/checkout/server/checkout.service"
import { PixelPurchase } from "@/features/visitors/components/meta-pixel"
import { formatEta } from "@/lib/delivery"
import { formatMoney } from "@/lib/money"

// Neutral title: the page may show a payment still clearing.
export const metadata: Metadata = {
  title: "Your order",
  description: "The SKELMET order you just placed.",
  robots: { index: false, follow: false },
}

// Order numbers are guessable: getConfirmation answers only for the browser or account that
// placed the order; anything else falls to <Unknown />, which names no one.

/** What the page can honestly say: COD is never "paid" until delivered, an advance is an advance. */
type Stage = "paid" | "advance" | "processing" | "cod" | "cancelled"

function stageOf(order: Confirmation): Stage {
  if (order.status === "CANCELLED") return "cancelled"
  if (order.paymentMethod === "COD" && order.status !== "DELIVERED") return "cod"
  if (order.status === "PENDING") return "processing"
  return order.paymentMethod === "PARTIAL" && order.status !== "DELIVERED" ? "advance" : "paid"
}

const HEADLINE: Record<Exclude<Stage, "cancelled">, string> = {
  paid: "Payment confirmed",
  advance: "Advance paid · balance on delivery",
  cod: "Order confirmed · pay on delivery",
  processing: "Payment processing",
}

const AMOUNT_LABEL: Record<Exclude<Stage, "cancelled">, string> = {
  paid: "Total paid",
  advance: "Paid now",
  cod: "Due on delivery",
  processing: "Amount due",
}

/** For an advance order, the advance (paid or clearing), not the total. */
function amountFor(order: Confirmation, stage: Stage): number {
  const total = Number(order.total)
  if (order.paymentMethod !== "PARTIAL" || stage === "paid") return total
  return Math.round((total - Number(order.dueOnDelivery)) * 100) / 100
}

// Stages, not day numbers: the policy promises no particular day.
function timelineFor(order: Confirmation, stage: Stage) {
  const { dispatchHours } = siteConfig.promise
  const shipped = order.status === "SHIPPED" || order.status === "DELIVERED"
  return [
    {
      Icon: Check,
      when: "Done · today",
      title: "Order placed",
      body:
        stage === "paid"
          ? "Payment cleared and your mount is reserved."
          : stage === "advance"
            ? `Your advance cleared and your mount is reserved. The remaining ${formatMoney(order.dueOnDelivery)} is paid to the courier on delivery.`
            : stage === "cod"
              ? "Your mount is reserved. You pay the courier on delivery."
              : "Your payment is clearing. We email you as soon as it does.",
      done: true,
    },
    {
      Icon: Truck,
      when: shipped ? "Done" : "Next",
      title: "Dispatched",
      body: `Packed and handed to the courier within ${dispatchHours} hours of ${stage === "cod" ? "your order" : "payment"}. The tracking link lands in your inbox.`,
      done: shipped,
    },
    {
      Icon: Home,
      when: formatEta(order.placedAt ?? new Date().toISOString()),
      title: "On your wall",
      body: "Ten minutes with a drill and the floor is free again.",
      done: order.status === "DELIVERED",
    },
  ]
}

/** A cancelled order: nothing paid, nothing coming, and a way back to the shop. */
function Cancelled({ order }: { order: Confirmation }) {
  const { refundDays, bankDays } = siteConfig.promise
  return (
    // Masked from Clarity recordings.
    <div
      data-clarity-mask="true"
      className="grain relative overflow-hidden px-5 py-20 text-center sm:px-8 sm:py-28"
    >
      <div className="relative z-10 mx-auto flex max-w-[520px] flex-col items-center">
        <div className="text-magenta mb-4 font-mono text-[11px] tracking-[0.2em] uppercase sm:text-[11.5px]">
          Order {order.number}
        </div>
        <h1 className="font-display text-bone mb-5 text-[44px] leading-[1.02] uppercase sm:text-[60px]">
          Order cancelled
        </h1>
        <p className="text-ash mb-9 text-[15.5px] leading-[1.6] text-pretty sm:text-[17px]">
          This order was cancelled, so nothing is on its way. If you paid for it, the refund goes to
          the original payment method within {refundDays}, and banks usually take {bankDays} more to
          show it.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <ButtonLink href="/product/flame-skull-mount" variant="light" size="md">
            Shop again
            <ArrowRight className="size-4" strokeWidth={2.4} />
          </ButtonLink>
          <ButtonLink href="/contact" variant="ghost" size="md">
            Contact us
          </ButtonLink>
        </div>
      </div>
    </div>
  )
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
          is in your inbox - look it up with your order number and we&apos;ll pull up the status.
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
  const stage = stageOf(order)
  if (stage === "cancelled") return <Cancelled order={order} />
  const timeline = timelineFor(order, stage)

  return (
    // Masked from Clarity recordings: shows the buyer's email and order.
    <div data-clarity-mask="true">
      {/* Fires only after cookie Accept; reports the whole order's value. */}
      <PixelPurchase
        order={{
          number: order.number,
          total: order.total,
          items: order.items.map((i) => ({ sku: i.sku, qty: i.qty, unitPrice: i.unitPrice })),
        }}
      />
      <div className="grain relative flex min-h-[calc(100dvh-74px-36px)] flex-col justify-center overflow-hidden px-5 py-10 text-center sm:px-8">
        <div className="animate-bloom absolute top-16 left-1/2 size-[280px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgb(255_90_31_/_0.34),transparent_66%)] blur-[30px] sm:size-[420px]" />
        <div className="animate-spin-rev border-blaze/30 absolute top-20 left-1/2 size-[260px] -translate-x-1/2 rounded-full border border-dashed sm:size-[388px]" />

        <div className="relative z-10 flex flex-col items-center">
          <div className="relative mb-5 aspect-square w-[168px] shrink-0 sm:w-[210px]">
            <SkullStage className="size-full" />
          </div>

          {/* Only a captured payment is "confirmed". */}
          <div
            className={
              stage === "processing"
                ? "text-ember mb-4 flex items-center gap-2.5 font-mono text-[11px] tracking-[0.2em] uppercase sm:text-[11.5px]"
                : "text-acid mb-4 flex items-center gap-2.5 font-mono text-[11px] tracking-[0.2em] uppercase sm:text-[11.5px]"
            }
          >
            {stage === "processing" ? (
              <Clock className="size-4" strokeWidth={2.4} />
            ) : (
              <Check className="size-4" strokeWidth={2.6} />
            )}
            {HEADLINE[stage]}
          </div>

          <h1 className="font-display text-bone mb-4 text-[clamp(34px,13vw,96px)] leading-[1.0] whitespace-nowrap uppercase">
            {/* The clamp fits "You're mounted" on one line; keep text no wider. */}
            {stage === "processing" ? (
              <>
                Almost <span className="text-blaze">there</span>
              </>
            ) : (
              <>
                You&apos;re <span className="text-blaze">mounted</span>
              </>
            )}
          </h1>

          {stage === "processing" ? (
            <p className="text-ash mb-7 max-w-[520px] text-[15px] leading-[1.6] text-pretty sm:text-[16.5px]">
              Your payment is processing. We&apos;ll email you at{" "}
              <span className="text-bone">{order.email}</span> as soon as it clears.
            </p>
          ) : (
            <p className="text-ash mb-7 max-w-[520px] text-[15px] leading-[1.6] text-pretty sm:text-[16.5px]">
              Order&apos;s in and the printers are already warm. We&apos;ve sent the confirmation to{" "}
              <span className="text-bone">{order.email}</span>, check spam if it&apos;s shy.
            </p>
          )}

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
                {formatEta(order.placedAt ?? new Date().toISOString())}
              </dd>
            </div>
            <div className="flex items-center justify-between px-5 py-4 sm:flex-1 sm:flex-col sm:items-start sm:gap-1.5">
              <dt className="text-dim font-mono text-[9.5px] tracking-[0.16em] uppercase">
                {AMOUNT_LABEL[stage]}
              </dt>
              <dd className="font-display text-bone text-[20px] leading-[1.12]">
                {formatMoney(amountFor(order, stage))}
                {order.paymentMethod === "PARTIAL" && stage !== "paid" ? (
                  <span className="text-ash block font-sans text-[12px] leading-[1.4] tracking-normal">
                    + {formatMoney(order.dueOnDelivery)} on delivery
                  </span>
                ) : null}
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
    </div>
  )
}
