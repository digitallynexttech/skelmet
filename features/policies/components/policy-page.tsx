import Image from "next/image"
import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { ButtonLink } from "@/components/ui/button"
import { HeroWatermark } from "@/components/shared/hero-watermark"
import { siteConfig } from "@/config/site"
import { POLICIES, type Inline, type Policy, type PolicyBlock } from "@/features/policies/policies"
import { cn } from "@/lib/utils"

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/**
 * `2026-09-28` → `28 Sep 2026`. Spelled out by hand: en-GB's short September
 * is "Sept" in current ICU, and the date should read the same everywhere.
 */
function formatUpdated(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number)
  return `${d} ${MONTHS[(m ?? 1) - 1]} ${y}`
}

function Text({ text }: { text: string | Inline[] }) {
  if (typeof text === "string") return text
  return text.map((part, i) =>
    typeof part === "string" ? (
      part
    ) : (
      <Link
        key={i}
        href={part.href}
        className="text-bone underline decoration-white/30 underline-offset-[3px] hover:decoration-white/70"
      >
        {part.text}
      </Link>
    ),
  )
}

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
    return (
      <p className="text-ash mb-4 max-w-[720px] text-[15px] leading-[1.72]">
        <Text text={block.text} />
      </p>
    )
  }

  if (block.type === "list") {
    return (
      <ul className="mb-4 flex max-w-[720px] flex-col gap-3">
        {block.items.map((item) => (
          <li key={item} className="text-ash flex gap-3 text-[15px] leading-[1.66]">
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
        <div className="rounded-tile min-w-[440px] overflow-hidden border border-white/[0.09]">
          <div
            className="bg-carbon grid gap-0 border-b border-white/[0.07]"
            style={{ gridTemplateColumns: `repeat(${block.head.length}, minmax(0, 1fr))` }}
          >
            {block.head.map((h) => (
              <div
                key={h}
                className="text-dim px-5 py-3.5 font-mono text-[11px] tracking-[0.14em] uppercase"
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

  // Contact block. The Consumer Protection (E-Commerce) Rules ask for the
  // grievance officer's contact details and designation; a designation rather
  // than a personal name, so the block outlives any one person in the role.
  const { address, promise } = siteConfig
  return (
    <div className="grid max-w-[720px] gap-3.5 sm:grid-cols-2">
      <div className="rounded-tile bg-carbon border border-white/[0.09] p-6">
        <div className="text-dim mb-3 font-mono text-[11px] tracking-[0.14em] uppercase">
          Grievance Officer
        </div>
        <address className="text-ash text-[14px] leading-[1.6] not-italic">
          <span className="text-bone">{siteConfig.legalEntity}</span>
          <br />
          {address.line1}
          <br />
          {address.city} {address.pin}
          <br />
          <a href={`mailto:${siteConfig.grievanceEmail}`} className="hover:text-bone">
            {siteConfig.grievanceEmail}
          </a>
          <br />
          <a href={`tel:${siteConfig.phone.replace(/\s/g, "")}`} className="hover:text-bone">
            {siteConfig.phone}
          </a>
        </address>
      </div>
      <div className="rounded-tile bg-carbon border border-white/[0.09] p-6">
        <div className="text-dim mb-3 font-mono text-[11px] tracking-[0.14em] uppercase">
          Response times
        </div>
        <div className="text-ash text-[14px] leading-[1.7]">
          Acknowledged within {promise.grievanceAckHours} hours
          <br />
          Resolved within {promise.grievanceResolution} (30 days)
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
            className="text-dim mb-5 flex items-center gap-2.5 font-mono text-[11px] tracking-[0.14em] uppercase"
          >
            <Link href="/" className="hover:text-bone">
              Home
            </Link>
            <span aria-hidden>/</span>
            <span>Legal</span>
            <span aria-hidden>/</span>
            <span className="text-bone">{policy.title}</span>
          </nav>

          <h1 className="font-display text-bone mb-5 text-[46px] leading-[1.0] uppercase sm:text-[64px] xl:text-[84px]">
            {policy.title}
          </h1>
          <p className="text-ash mb-6 max-w-[640px] text-[16px] leading-[1.64] sm:text-[17px]">
            {policy.intro}
          </p>

          <div className="flex flex-wrap items-center gap-2.5">
            <Badge variant="acid">Last updated {formatUpdated(policy.updated)}</Badge>
            <Badge variant="outline">Version {policy.version}</Badge>
            <Badge variant="outline">{policy.readingTime}</Badge>
          </div>
        </div>
      </div>

      {/* Body */}
      {/* minmax(0,1fr) below lg too: an auto column grew to fit a table's
          min-width, and the whole page scrolled sideways on a phone. */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-10 px-5 py-11 pb-20 sm:px-8 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-16 xl:px-14">
        <aside>
          <div className="lg:sticky lg:top-24">
            <div className="text-dim mb-4 font-mono text-[11px] tracking-[0.14em] uppercase">
              On this page
            </div>
            <nav className="mb-7 flex flex-col">
              {policy.sections.map((s, i) => (
                <a
                  key={s.n}
                  href={`#s-${s.n}`}
                  className={cn(
                    "hover:text-bone border-b border-white/[0.05] py-2.5 text-[13.5px] transition-colors",
                    i === 0 ? cn("border-l-2 pl-3", ACCENT_TEXT[policy.accent]) : "text-ash",
                  )}
                  style={i === 0 ? { borderLeftColor: "currentColor" } : undefined}
                >
                  {s.n} · {s.title}
                </a>
              ))}
            </nav>

            <div className="rounded-tile bg-carbon border border-white/[0.09] p-5">
              <div className="text-dim mb-2.5 font-mono text-[11px] tracking-[0.14em] uppercase">
                Short version
              </div>
              <p className="text-ash text-[13px] leading-[1.6]">{policy.shortVersion}</p>
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
              <h2 className="font-display text-bone mb-3.5 text-[26px] leading-none uppercase sm:text-[30px]">
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
        <div className="text-dim mb-5 font-mono text-[11px] tracking-[0.18em] uppercase">
          Related policies
        </div>
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {others.map((p) => (
            <Link
              key={p.slug}
              href={`/policies/${p.slug}`}
              className="rounded-tile bg-carbon flex items-center justify-between gap-3 border border-white/[0.09] p-6 transition-colors hover:border-white/20"
            >
              <span className="text-bone text-[15px] font-semibold">{p.title}</span>
              <ArrowRight className="text-ember size-4 shrink-0" strokeWidth={2.2} />
            </Link>
          ))}
        </div>
      </div>

      {/* CTA */}
      <section className="grid border-t border-white/[0.07] lg:grid-cols-2">
        <div className="bg-carbon flex flex-col justify-center px-5 py-14 sm:px-8 xl:px-14">
          <h2 className="font-display text-bone mb-4 text-[36px] leading-[1.04] uppercase sm:text-[46px]">
            Still got a question?
          </h2>
          <p className="text-ash mb-7 max-w-[420px] text-[15.5px] leading-[1.6]">
            A human reads every message, and we reply within {siteConfig.promise.supportReply}.
            Anything about your data goes straight to the Grievance Officer.
          </p>
          <ButtonLink href="/contact" variant="primary" size="md" className="self-start">
            Contact us
            <ArrowRight className="size-4" strokeWidth={2.4} />
          </ButtonLink>
        </div>
        <div className="relative order-first min-h-[240px] lg:order-last lg:min-h-[300px]">
          <Image
            src="/product/mount-side.jpg"
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
