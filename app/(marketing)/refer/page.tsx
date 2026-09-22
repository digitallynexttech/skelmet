import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { ArrowRight, Info } from "lucide-react"

import { FaqSection } from "@/components/marketing/faq-section"
import { Section, SectionHeading } from "@/components/marketing/section"
import { SectionLabel } from "@/components/shared/section-label"
import { Badge } from "@/components/ui/badge"
import { ButtonLink } from "@/components/ui/button"
import { ReferralPanel } from "@/features/referrals/components/referral-panel"
import { REFERRAL_REWARD } from "@/lib/constants"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "Refer & earn",
  description: `Send your code, they save ₹${REFERRAL_REWARD}, you earn ₹${REFERRAL_REWARD} when their order ships. No cap, no expiry.`,
  alternates: { canonical: "/refer" },
  // Hidden for now: unlinked from nav and sitemap, and kept out of the index
  // while the programme is on hold. Drop this block to bring it back.
  robots: { index: false, follow: false },
}

const STEPS = [
  {
    n: "01",
    title: "Grab your code",
    body: "Every order comes with one. No order yet? Sign up and we'll generate it in two seconds.",
  },
  {
    n: "02",
    title: "Drop it anywhere",
    body: "WhatsApp, Instagram story, the club group, your bio. One tap copies the whole link.",
  },
  {
    n: "03",
    title: "Get paid out",
    body: "₹250 lands in your balance the day their order ships. Cash out to UPI at ₹500.",
  },
]

const INVITES = [
  { who: "a****k@gmail.com", sent: "12 AUG", status: "PAID", tone: "acid", earned: "₹250" },
  { who: "d***s@outlook.com", sent: "09 AUG", status: "PAID", tone: "acid", earned: "₹250" },
  { who: "n****a@gmail.com", sent: "04 AUG", status: "SHIPPING", tone: "ember", earned: "₹250" },
  { who: "v**y@gmail.com", sent: "28 JUL", status: "OPENED", tone: "muted", earned: "-" },
  { who: "s****t@yahoo.in", sent: "21 JUL", status: "SENT", tone: "muted", earned: "-" },
] as const

const TIERS = [
  {
    name: "Wingman",
    hex: "#C8CED6",
    range: "1–4 referrals",
    perks: ["₹250 per order that ships", "Cash out from ₹500"],
    current: false,
  },
  {
    name: "Roadcaptain",
    hex: "#FF5A1F",
    range: "5–14 referrals",
    perks: ["₹350 per order that ships", "Early access to new colourways", "Cash out from ₹500"],
    current: true,
  },
  {
    name: "Reaper",
    hex: "#D4FF3D",
    range: "15+ referrals",
    perks: [
      "₹500 per order that ships",
      "A custom-colour mount, on us",
      "Your name on the rider wall",
    ],
    current: false,
  },
]

export default function ReferPage() {
  return (
    <>
      <div className="grain relative overflow-hidden border-b border-white/[0.07] px-5 pt-14 pb-14 sm:px-8 xl:px-14">
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_480px]">
          <div>
            <SectionLabel tone="acid" className="mb-5">
              Refer &amp; earn
            </SectionLabel>
            <h1 className="font-display text-bone mb-6 text-[52px] leading-[1.0] uppercase sm:text-[74px] xl:text-[96px]">
              Get paid for
              <br />
              having <span className="text-acid">taste</span>
            </h1>
            <p className="text-ash mb-8 max-w-[500px] text-[16px] leading-[1.62] text-pretty sm:text-[17.5px]">
              Someone in your group chat has a helmet on the floor right now. Send them your code,
              they save &#8377;{REFERRAL_REWARD}, you bank &#8377;{REFERRAL_REWARD} the moment their
              order ships.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <ButtonLink href="#code" variant="accent" size="lg">
                Get my code
                <ArrowRight className="size-4" strokeWidth={2.4} />
              </ButtonLink>
              <span className="text-dim font-mono text-[11.5px] tracking-[0.14em] uppercase">
                No cap · no expiry
              </span>
            </div>
          </div>

          <div className="relative aspect-square w-full">
            <div className="animate-spin-rev border-acid/28 absolute inset-[8%] rounded-full border border-dashed" />
            <div className="absolute inset-[22%] rounded-full bg-[radial-gradient(circle,rgb(212_255_61_/_0.22),transparent_66%)] blur-[24px]" />
            <Image
              src="/product/hero-skull.jpg"
              alt="SKELMET mount"
              fill
              sizes="480px"
              className="screen animate-drift object-contain p-[18%] [filter:saturate(0.5)_hue-rotate(48deg)_brightness(1.05)]"
            />
            <span className="border-acid/30 bg-carbon/85 text-acid absolute top-[14%] right-[4%] rounded-lg border px-3.5 py-2.5 font-mono text-[10px] tracking-[0.12em]">
              + &#8377;{REFERRAL_REWARD}
            </span>
            <span className="border-acid/30 bg-carbon/85 text-acid absolute bottom-[22%] left-[2%] rounded-lg border px-3.5 py-2.5 font-mono text-[10px] tracking-[0.12em]">
              + &#8377;{REFERRAL_REWARD}
            </span>
          </div>
        </div>
      </div>

      <Section className="bg-carbon border-b border-white/[0.07]">
        <SectionHeading className="mb-10">Three steps, no catch</SectionHeading>
        <ol className="grid gap-5 lg:grid-cols-3">
          {STEPS.map((step, i) => (
            <li
              key={step.n}
              className={cn(
                "rounded-card bg-void border p-7 sm:p-8",
                i === 2
                  ? "border-acid/30 bg-[linear-gradient(160deg,rgb(212_255_61_/_0.09),transparent_58%)]"
                  : "border-white/[0.09]",
              )}
            >
              <div
                className={cn(
                  "font-display mb-5 text-[52px] leading-none sm:text-[60px]",
                  i === 2 ? "text-acid" : "text-acid/30",
                )}
              >
                {step.n}
              </div>
              <h3 className="font-display text-bone mb-3 text-[26px] leading-[1.08] uppercase sm:text-[28px]">
                {step.title}
              </h3>
              <p className="text-ash text-[15px] leading-[1.6]">{step.body}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section id="code">
        <div className="grid gap-6 lg:grid-cols-[480px_minmax(0,1fr)]">
          <ReferralPanel />

          <div className="rounded-card bg-carbon border border-white/10 p-6 sm:p-8">
            <div className="mb-6 flex items-center justify-between gap-4">
              <h2 className="font-display text-bone text-[26px] leading-[1.08] uppercase sm:text-[28px]">
                Your invites
              </h2>
              <span className="text-dim font-mono text-[11px] tracking-[0.12em]">
                8 SENT · 5 CONVERTED
              </span>
            </div>

            <div className="-mx-2 overflow-x-auto px-2">
              <div className="min-w-[460px]">
                <div className="text-dim grid grid-cols-[1.4fr_1fr_1fr_0.9fr] gap-4 border-b border-white/10 pb-3.5 font-mono text-[10.5px] tracking-[0.16em] uppercase">
                  <span>Who</span>
                  <span>Sent</span>
                  <span>Status</span>
                  <span className="text-right">Earned</span>
                </div>
                {INVITES.map((inv) => (
                  <div
                    key={inv.who}
                    className="grid grid-cols-[1.4fr_1fr_1fr_0.9fr] items-center gap-4 border-b border-white/[0.07] py-4 text-[14px] last:border-b-0"
                  >
                    <span className="text-bone truncate">{inv.who}</span>
                    <span className="text-ash font-mono text-[12.5px]">{inv.sent}</span>
                    <span>
                      <Badge variant={inv.tone}>{inv.status}</Badge>
                    </span>
                    <span
                      className={cn(
                        "text-right font-mono",
                        inv.earned === "-"
                          ? "text-faint"
                          : inv.tone === "acid"
                            ? "text-acid"
                            : "text-ash",
                      )}
                    >
                      {inv.earned}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Section>

      <Section className="bg-carbon border-t border-white/[0.07]">
        <div className="mb-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeading>
            Keep going,
            <br />
            keep climbing
          </SectionHeading>
          <p className="text-ash max-w-[340px] text-[15px] leading-[1.6] lg:pb-2 lg:text-right">
            Tiers reset never. Once you&apos;re up there, you stay up there.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          {TIERS.map((tier) => (
            <article
              key={tier.name}
              className={cn(
                "rounded-card bg-void border p-7 sm:p-8",
                tier.current
                  ? "border-blaze/35 bg-[linear-gradient(160deg,rgb(255_90_31_/_0.1),transparent_56%)]"
                  : "border-white/[0.09]",
              )}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="size-3.5 rounded-full" style={{ backgroundColor: tier.hex }} />
                  <h3 className="font-display text-bone text-[24px] leading-[1.08] uppercase sm:text-[26px]">
                    {tier.name}
                  </h3>
                </div>
                {tier.current ? <Badge variant="blaze">You</Badge> : null}
              </div>
              <div className="text-dim mb-6 font-mono text-[11.5px] tracking-[0.14em] uppercase">
                {tier.range}
              </div>
              <ul className="flex flex-col gap-3">
                {tier.perks.map((perk, i) => (
                  <li
                    key={perk}
                    className={cn(
                      "text-[14.5px]",
                      i === 0 && tier.current ? "text-bone" : "text-ash",
                    )}
                  >
                    {perk}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <div className="rounded-tile bg-void mt-8 flex items-start gap-3 border border-white/[0.08] p-5 sm:p-6">
          <Info className="text-dim mt-0.5 size-[18px] shrink-0" strokeWidth={1.8} />
          <p className="text-dim text-[13.5px] leading-[1.6]">
            Rewards are credited once the referred order has shipped and cleared the 7-day return
            window. Self-referrals and duplicate accounts are void. Full terms at{" "}
            <Link href="/policies/referral" className="text-ash underline-offset-2 hover:underline">
              /policies/referral
            </Link>
            .
          </p>
        </div>
      </Section>

      <FaqSection />
    </>
  )
}
