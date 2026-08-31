import Image from "next/image"
import Link from "next/link"
import { AlertTriangle, ArrowRight } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { ButtonLink } from "@/components/ui/button"
import { HeroWatermark } from "@/components/shared/hero-watermark"
import { siteConfig } from "@/config/site"
import { POLICIES, type Policy, type PolicyBlock } from "@/features/policies/policies"
import { cn } from "@/lib/utils"

const ACCENT_TEXT = {
  blaze: "text-blaze",
  violet: "text-violet",
  acid: "text-acid",
  magenta: "text-magenta",
} as const

const ACCENT_DOT = {
  blaze: "bg-blaze",
  violet: "bg-violet",
  acid: "bg-acid",
  magenta: "bg-magenta",
} as const


function Block({ block, accent }: { block: PolicyBlock; accent: Policy["accent"] }) {
  if (block.type === "p") {
    return <p className="mb-4 max-w-[720px] text-[15px] leading-[1.72] text-ash">{block.text}</p>
  }

  if (block.type === "list") {
    return (
      <ul className="mb-4 flex max-w-[720px] flex-col gap-3">
        {block.items.map((item) => (
          <li key={item} className="flex gap-3 text-[15px] leading-[1.66] text-ash">
            <span className={cn("mt-2 size-1.5 shrink-0 rounded-full", ACCENT_DOT[accent])} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    )
  }

  if (block.type === "table") {
    return (
      <div className="mb-4 max-w-[720px] overflow-x-auto">
        <div className="min-w-[440px] overflow-hidden rounded-tile border border-white/[0.09]">
          <div
            className="grid gap-0 border-b border-white/[0.07] bg-carbon"
            style={{ gridTemplateColumns: `repeat(${block.head.length}, minmax(0, 1fr))` }}
          >
            {block.head.map((h) => (
              <div
                key={h}
                className="px-5 py-3.5 font-mono text-[10px] tracking-[0.16em] text-dim uppercase"
              >
                {h}
              </div>
            ))}
          </div>
          {block.rows.map((row) => (
            <div
              key={row.join("|")}
              className="grid border-b border-white/[0.06] last:border-b-0"
              style={{ gridTemplateColumns: `repeat(${block.head.length}, minmax(0, 1fr))` }}
            >
              {row.map((cell, i) => (
                <div
                  key={cell + i}
                  className={cn("px-5 py-4 text-[13.5px]", i === 0 ? "text-bone" : "text-ash")}
                >
                  {cell}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // contact block
  return (
    <div className="grid max-w-[720px] gap-3.5 sm:grid-cols-2">
      <div className="rounded-tile border border-white/[0.09] bg-carbon p-6">
        <div className="mb-3 font-mono text-[10px] tracking-[0.16em] text-dim uppercase">
          Grievance officer
        </div>
        <div className="text-[14px] leading-[1.6] text-ash">
          {siteConfig.grievanceEmail}
          <br />
          {siteConfig.phone}
        </div>
      </div>
      <div className="rounded-tile border border-white/[0.09] bg-carbon p-6">
        <div className="mb-3 font-mono text-[10px] tracking-[0.16em] text-dim uppercase">
          Response times
        </div>
        <div className="text-[14px] leading-[1.7] text-ash">
          Acknowledgement: [48] hours
          <br />
          Resolution: [30] days
        </div>
      </div>
    </div>
  )
}

export function PolicyPage({ policy }: { policy: Policy }) {
  const others = POLICIES.filter((p) => p.slug !== policy.slug)

  return (
    <>
      {/* Hero */}
      <div className="grain relative overflow-hidden border-b border-white/[0.07] px-5 pt-12 pb-12 sm:px-8 xl:px-14">
        <HeroWatermark accent={policy.accent}>Legal</HeroWatermark>

        <div className="relative z-10">
          <nav
            aria-label="Breadcrumb"
            className="mb-5 flex items-center gap-2.5 font-mono text-[11px] tracking-[0.14em] text-dim uppercase"
          >
            <Link href="/" className="hover:text-bone">
              Home
            </Link>
            <span aria-hidden>/</span>
            <span>Legal</span>
            <span aria-hidden>/</span>
            <span className="text-bone">{policy.title}</span>
          </nav>

          <h1 className="mb-5 font-display text-[46px] leading-[1.0] text-bone uppercase sm:text-[64px] xl:text-[84px]">
            {policy.title}
          </h1>
          <p className="mb-6 max-w-[640px] text-[16px] leading-[1.64] text-ash sm:text-[17px]">
            {policy.intro}
          </p>

          <div className="flex flex-wrap items-center gap-2.5">
            <Badge variant="acid">Last updated [DD MMM 2026]</Badge>
            <Badge variant="outline">Version [1.0]</Badge>
            <Badge variant="outline">{policy.readingTime}</Badge>
          </div>
        </div>
      </div>

      {/* Not-legal-advice banner */}
      <div className="mx-5 mt-7 flex items-start gap-3.5 rounded-tile border border-dashed border-magenta/45 bg-magenta/[0.05] p-5 sm:mx-8 xl:mx-14">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-magenta" strokeWidth={1.9} />
        <p className="text-[13.5px] leading-[1.62] text-[#c9c6d4]">
          <span className="font-bold text-magenta">DRAFT STRUCTURE · NOT LEGAL ADVICE.</span> This
          page carries the sections an Indian D2C store needs (DPDP Act 2023, Consumer Protection
          E-Commerce Rules 2020). Every bracketed value and the final wording must be settled by your
          lawyer before launch.
        </p>
      </div>

      {/* Body */}
      <div className="grid gap-10 px-5 py-11 pb-20 sm:px-8 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-16 xl:px-14">
        <aside>
          <div className="lg:sticky lg:top-24">
            <div className="mb-4 font-mono text-[10.5px] tracking-[0.18em] text-dim uppercase">
              On this page
            </div>
            <nav className="mb-7 flex flex-col">
              {policy.sections.map((s, i) => (
                <a
                  key={s.n}
                  href={`#s-${s.n}`}
                  className={cn(
                    "border-b border-white/[0.05] py-2.5 text-[13.5px] transition-colors hover:text-bone",
                    i === 0
                      ? cn("border-l-2 pl-3", ACCENT_TEXT[policy.accent])
                      : "text-ash",
                  )}
                  style={i === 0 ? { borderLeftColor: "currentColor" } : undefined}
                >
                  {s.n} · {s.title}
                </a>
              ))}
            </nav>

            <div className="rounded-tile border border-white/[0.09] bg-carbon p-5">
              <div className="mb-2.5 font-mono text-[10px] tracking-[0.16em] text-dim uppercase">
                Short version
              </div>
              <p className="text-[13px] leading-[1.6] text-ash">{policy.shortVersion}</p>
            </div>
          </div>
        </aside>

        <div>
          {policy.sections.map((section, i) => (
            <section
              key={section.n}
              id={`s-${section.n}`}
              className={cn(
                "scroll-mt-24 border-b border-white/[0.08] py-9 last:border-b-0",
                i === 0 && "pt-0",
              )}
            >
              <div
                className={cn(
                  "mb-3 font-mono text-[11px] tracking-[0.18em]",
                  ACCENT_TEXT[policy.accent],
                )}
              >
                {section.n}
              </div>
              <h2 className="mb-3.5 font-display text-[26px] leading-none text-bone uppercase sm:text-[30px]">
                {section.title}
              </h2>
              {section.blocks.map((block, bi) => (
                <Block key={bi} block={block} accent={policy.accent} />
              ))}
            </section>
          ))}
        </div>
      </div>

      {/* Related */}
      <div className="px-5 pb-16 sm:px-8 xl:px-14">
        <div className="mb-5 font-mono text-[11px] tracking-[0.18em] text-dim uppercase">
          Related policies
        </div>
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {others.map((p) => (
            <Link
              key={p.slug}
              href={`/policies/${p.slug}`}
              className="flex items-center justify-between gap-3 rounded-tile border border-white/[0.09] bg-carbon p-6 transition-colors hover:border-white/20"
            >
              <span className="text-[15px] font-semibold text-bone">{p.title}</span>
              <ArrowRight className="size-4 shrink-0 text-ember" strokeWidth={2.2} />
            </Link>
          ))}
        </div>
      </div>

      {/* CTA */}
      <section className="grid border-t border-white/[0.07] lg:grid-cols-2">
        <div className="flex flex-col justify-center bg-carbon px-5 py-14 sm:px-8 xl:px-14">
          <h2 className="mb-4 font-display text-[36px] leading-[1.04] text-bone uppercase sm:text-[46px]">
            Still got a question?
          </h2>
          <p className="mb-7 max-w-[420px] text-[15.5px] leading-[1.6] text-ash">
            A human reads every message. Anything about your data goes straight to the grievance
            officer.
          </p>
          <ButtonLink href="/contact" variant="primary" size="md" className="self-start">
            Contact us
            <ArrowRight className="size-4" strokeWidth={2.4} />
          </ButtonLink>
        </div>
        <div className="relative order-first min-h-[240px] lg:order-last lg:min-h-[300px]">
          <Image
            src="/product/product-profile.jpg"
            alt="Side profile of the SKELMET mount"
            fill
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover"
          />
        </div>
      </section>
    </>
  )
}
