import type { Metadata } from "next"
import { ArrowRight, PackageSearch } from "lucide-react"

import { Section } from "@/components/marketing/section"
import { TrustStrip } from "@/components/marketing/trust-strip"
import { HeroWatermark } from "@/components/shared/hero-watermark"
import { SectionLabel } from "@/components/shared/section-label"
import { Button } from "@/components/ui/button"
import { Field, Input } from "@/components/ui/input"

export const metadata: Metadata = {
  title: "Track your order",
  description: "Order number and email: no account needed.",
  alternates: { canonical: "/track" },
}

export default function TrackPage() {
  return (
    <>
      <Section className="pb-10">
        {/* The watermark wraps the heading only, not the whole Section: the order
            form below is tall enough that centring against it would drop the mark
            far lower than it sits on every other page. */}
        <div className="relative overflow-hidden">
          <HeroWatermark accent="ember">Track</HeroWatermark>

          <div className="relative z-10">
            <SectionLabel className="mb-4">Track order</SectionLabel>
            <h1 className="mb-5 font-display text-[48px] leading-[1.0] text-bone uppercase sm:text-[68px] xl:text-[80px]">
              Where is it?
            </h1>
            <p className="max-w-[520px] text-[16px] leading-[1.62] text-ash sm:text-[17.5px]">
              Order number and the email you used. No account, no password, no hunting through your
              inbox for a link.
            </p>
          </div>
        </div>

        <div className="mt-10">
          <form className="max-w-[520px] rounded-card border border-white/10 bg-carbon p-6 sm:p-8">
            <div className="mb-5 flex items-center gap-3">
              <PackageSearch className="size-5 text-ember" strokeWidth={1.8} />
              <span className="font-mono text-[10.5px] tracking-[0.18em] text-dim uppercase">
                Order lookup
              </span>
            </div>
            <div className="flex flex-col gap-4">
              <Field label="Order number">
                <Input
                  name="orderNumber"
                  required
                  placeholder="SKM-2026-0412"
                  className="font-mono tracking-[0.06em]"
                />
              </Field>
              <Field label="Email on the order">
                <Input name="email" type="email" required placeholder="you@example.com" />
              </Field>
              <Button type="submit" variant="primary" size="md" full className="mt-1">
                Track it
                <ArrowRight className="size-4" strokeWidth={2.4} />
              </Button>
            </div>
          </form>
        </div>
      </Section>
      <TrustStrip />
    </>
  )
}
