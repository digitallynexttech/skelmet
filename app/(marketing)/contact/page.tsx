import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { ArrowRight, Mail } from "lucide-react"

import { FaqSection } from "@/components/marketing/faq-section"
import { pageMetadata } from "@/components/marketing/page-metadata"
import { Section } from "@/components/marketing/section"
import { HeroWatermark } from "@/components/shared/hero-watermark"
import { WhatsappIcon } from "@/components/shared/social-icons"
import { siteConfig } from "@/config/site"
import { ContactForm, ContactFormFromLink } from "@/features/inquiries/components/contact-form"

export const metadata: Metadata = pageMetadata({
  title: "Contact us",
  description: `Talk to a human at SKELMET. No ticket queue, no bot: one of us reads every message, and we reply within ${siteConfig.promise.supportReply}.`,
  path: "/contact",
})

const HOURS = [
  { day: "Mon – Fri", time: "10:00 – 18:00" },
  { day: "Saturday", time: "11:00 – 16:00" },
  { day: "Sunday", time: "RIDING" },
]

export default function ContactPage() {
  return (
    <>
      <div className="grain relative overflow-hidden border-b border-white/[0.07] px-5 pt-14 pb-12 sm:px-8 xl:px-14">
        <HeroWatermark accent="acid">Contact</HeroWatermark>

        <div className="relative z-10">
          <h1 className="font-display text-bone mb-5 text-[52px] leading-[1.0] uppercase sm:text-[72px] xl:text-[88px]">
            Talk to a
            <br />
            human
          </h1>
          <p className="text-ash max-w-[520px] text-[16px] leading-[1.6] text-pretty sm:text-[17.5px]">
            No ticket queue, no bot that loops you back to the FAQ. One of us reads every message,
            and we reply within {siteConfig.promise.supportReply}.
          </p>
        </div>
      </div>

      <Section className="pt-10">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
          {/* Reads ?topic= in the browser (the page is prerendered); the fallback is the same form. */}
          <Suspense fallback={<ContactForm />}>
            <ContactFormFromLink />
          </Suspense>

          <aside className="flex flex-col gap-3.5">
            <a
              href={siteConfig.social.whatsapp}
              target="_blank"
              rel="noreferrer noopener"
              className="rounded-tile border-acid/30 bg-carbon hover:border-acid/50 border bg-[linear-gradient(160deg,rgb(212_255_61_/_0.07),transparent_56%)] p-6 transition-colors"
            >
              <div className="mb-3.5 flex items-center gap-3">
                <WhatsappIcon className="text-acid size-5" />
                <span className="font-display text-bone text-[22px] leading-[1.08] uppercase">
                  WhatsApp
                </span>
              </div>
              <p className="text-ash mb-4 text-[14.5px] leading-[1.56]">
                Handy for anything order-related, photos included. We reply within{" "}
                {siteConfig.promise.supportReply}.
              </p>
              <div className="text-acid font-mono text-[15px] tracking-[0.06em]">
                {siteConfig.phone}
              </div>
            </a>

            <a
              href={`mailto:${siteConfig.email}`}
              className="rounded-tile bg-carbon border border-white/10 p-6 transition-colors hover:border-white/25"
            >
              <div className="mb-3.5 flex items-center gap-3">
                <Mail className="text-ember size-5" strokeWidth={1.8} />
                <span className="font-display text-bone text-[22px] leading-[1.08] uppercase">
                  Email
                </span>
              </div>
              <p className="text-ash mb-4 text-[14.5px] leading-[1.56]">
                For returns, invoices and anything that needs a paper trail.
              </p>
              <div className="text-ember font-mono text-[15px] tracking-[0.04em]">
                {siteConfig.email}
              </div>
            </a>

            <div className="rounded-tile bg-carbon border border-white/10 p-6">
              <div className="text-dim mb-4 font-mono text-[11px] tracking-[0.14em] uppercase">
                The business
              </div>
              <address className="text-ash text-[14px] leading-[1.6] not-italic">
                <span className="text-bone">{siteConfig.legalEntity}</span>, a{" "}
                {siteConfig.legalForm} trading as {siteConfig.name}
                <br />
                {siteConfig.address.line1}
                <br />
                {siteConfig.address.city} {siteConfig.address.pin}
                <br />
                <a href={`tel:${siteConfig.phone.replace(/\s/g, "")}`} className="hover:text-bone">
                  {siteConfig.phone}
                </a>
                <br />
                <a href={`mailto:${siteConfig.email}`} className="hover:text-bone">
                  {siteConfig.email}
                </a>
                <br />
                <span className="font-mono text-[12.5px] tracking-[0.04em]">
                  GSTIN {siteConfig.gstin}
                </span>
              </address>
            </div>

            <div className="rounded-tile bg-carbon border border-white/10 p-6">
              <div className="text-dim mb-4 font-mono text-[11px] tracking-[0.14em] uppercase">
                We reply
              </div>
              <dl className="flex flex-col gap-3">
                {HOURS.map((h) => (
                  <div key={h.day} className="flex justify-between text-[14px]">
                    <dt className="text-ash">{h.day}</dt>
                    <dd className="text-bone font-mono text-[13px]">{h.time}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </aside>
        </div>

        <div className="rounded-card bg-carbon mt-10 flex flex-col gap-5 border border-dashed border-white/[0.16] p-7 sm:flex-row sm:items-center sm:justify-between sm:p-9">
          <div>
            <h2 className="font-display text-bone mb-2 text-[24px] leading-[1.08] uppercase sm:text-[28px]">
              Might already be answered
            </h2>
            <p className="text-ash text-[15px]">
              Fitment, drilling, shipping, returns and payment are all covered below.
            </p>
          </div>
          <Link
            href="#faq"
            className="text-bone inline-flex h-12 shrink-0 items-center gap-2.5 rounded-full border border-white/20 px-6 text-[13.5px] font-semibold tracking-[0.05em] uppercase transition-colors hover:border-white/40"
          >
            Read the FAQ
            <ArrowRight className="size-4" strokeWidth={2.2} />
          </Link>
        </div>
      </Section>

      <FaqSection />
    </>
  )
}
