import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { ArrowRight, Mail, MapPin } from "lucide-react"

import { FaqSection } from "@/components/marketing/faq-section"
import { Section } from "@/components/marketing/section"
import { SectionLabel } from "@/components/shared/section-label"
import { WhatsappIcon } from "@/components/shared/social-icons"
import { siteConfig } from "@/config/site"
import { ContactForm } from "@/features/inquiries/components/contact-form"

export const metadata: Metadata = {
  title: "Contact us",
  description:
    "Talk to a human at SKELMET. No ticket queue, no bot, one of us reads every message and replies within a working day.",
  alternates: { canonical: "/contact" },
}

const HOURS = [
  { day: "Mon – Fri", time: "10:00 – 19:00" },
  { day: "Saturday", time: "11:00 – 16:00" },
  { day: "Sunday", time: "RIDING" },
]

export default function ContactPage() {
  return (
    <>
      <div className="grain relative overflow-hidden border-b border-white/[0.07] px-5 pt-14 pb-12 sm:px-8 xl:px-14">
        <div className="flex flex-col gap-10 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <SectionLabel className="mb-4">Contact</SectionLabel>
            <h1 className="mb-5 font-display text-[52px] leading-[1.0] text-bone uppercase sm:text-[72px] xl:text-[88px]">
              Talk to a
              <br />
              human
            </h1>
            <p className="max-w-[520px] text-[16px] leading-[1.6] text-ash text-pretty sm:text-[17.5px]">
              No ticket queue, no bot that loops you back to the FAQ. One of us reads every message
              and replies within a working day.
            </p>
          </div>
          <div className="relative aspect-square w-full max-w-[280px] shrink-0 self-center">
            <Image
              src="/product/hero-skull.jpg"
              alt=""
              fill
              sizes="280px"
              className="screen animate-drift object-cover"
            />
          </div>
        </div>
      </div>

      <Section className="pt-10">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
          <ContactForm />

          <aside className="flex flex-col gap-3.5">
            <a
              href={siteConfig.social.whatsapp}
              target="_blank"
              rel="noreferrer noopener"
              className="rounded-tile border border-acid/30 bg-[linear-gradient(160deg,rgb(212_255_61_/_0.07),transparent_56%)] bg-carbon p-6 transition-colors hover:border-acid/50"
            >
              <div className="mb-3.5 flex items-center gap-3">
                <WhatsappIcon className="size-5 text-acid" />
                <span className="font-display leading-[1.08] text-[22px] text-bone uppercase">WhatsApp</span>
              </div>
              <p className="mb-4 text-[14.5px] leading-[1.56] text-ash">
                Fastest route for anything order-related. Usually answered within a couple of hours.
              </p>
              <div className="font-mono text-[15px] tracking-[0.06em] text-acid">
                {siteConfig.phone}
              </div>
            </a>

            <a
              href={`mailto:${siteConfig.email}`}
              className="rounded-tile border border-white/10 bg-carbon p-6 transition-colors hover:border-white/25"
            >
              <div className="mb-3.5 flex items-center gap-3">
                <Mail className="size-5 text-ember" strokeWidth={1.8} />
                <span className="font-display leading-[1.08] text-[22px] text-bone uppercase">Email</span>
              </div>
              <p className="mb-4 text-[14.5px] leading-[1.56] text-ash">
                For returns, invoices and anything that needs a paper trail.
              </p>
              <div className="font-mono text-[15px] tracking-[0.04em] text-ember">
                {siteConfig.email}
              </div>
            </a>

            <div className="rounded-tile border border-white/10 bg-carbon p-6">
              <div className="mb-3.5 flex items-center gap-3">
                <MapPin className="size-5 text-ember" strokeWidth={1.8} />
                <span className="font-display leading-[1.08] text-[22px] text-bone uppercase">The workshop</span>
              </div>
              <p className="mb-3 text-[14.5px] leading-[1.56] text-ash">
                Not a shopfront, but if you&apos;re local and want to see one in person, message
                first and we&apos;ll sort it.
              </p>
              <address className="text-[14.5px] leading-[1.6] text-ember not-italic">
                {siteConfig.address.line1}
                <br />
                {siteConfig.address.city}, {siteConfig.address.pin}
              </address>
            </div>

            <div className="rounded-tile border border-white/10 bg-carbon p-6">
              <div className="mb-4 font-mono text-[10.5px] tracking-[0.18em] text-dim uppercase">
                We reply
              </div>
              <dl className="flex flex-col gap-3">
                {HOURS.map((h) => (
                  <div key={h.day} className="flex justify-between text-[14px]">
                    <dt className="text-ash">{h.day}</dt>
                    <dd className="font-mono text-[13px] text-bone">{h.time}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </aside>
        </div>

        <div className="mt-10 flex flex-col gap-5 rounded-card border border-dashed border-white/[0.16] bg-carbon p-7 sm:flex-row sm:items-center sm:justify-between sm:p-9">
          <div>
            <h2 className="mb-2 font-display leading-[1.08] text-[24px] text-bone uppercase sm:text-[28px]">
              Might already be answered
            </h2>
            <p className="text-[15px] text-ash">
              Fitment, drilling, shipping times and returns are all covered below.
            </p>
          </div>
          <Link
            href="#faq"
            className="inline-flex h-12 shrink-0 items-center gap-2.5 rounded-full border border-white/20 px-6 text-[13.5px] font-semibold tracking-[0.05em] text-bone uppercase transition-colors hover:border-white/40"
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
