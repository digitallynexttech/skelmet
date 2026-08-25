import { Share2 } from "lucide-react"

import { SectionLabel } from "@/components/shared/section-label"
import { ButtonLink } from "@/components/ui/button"
import { REFERRAL_REWARD } from "@/lib/constants"

export function ReferBand() {
  return (
    <section className="grain relative overflow-hidden bg-[linear-gradient(104deg,var(--color-violet)_0%,var(--color-magenta)_46%,var(--color-blaze)_100%)] px-5 py-16 sm:px-8 sm:py-20 xl:px-14">
      <div
        aria-hidden
        className="absolute -top-12 right-8 font-display text-[140px] leading-none text-void/[0.13] select-none sm:text-[210px]"
      >
        &#8377;{REFERRAL_REWARD}
      </div>

      <div className="relative z-10 flex flex-col gap-10 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <SectionLabel index="14" className="mb-3.5 text-void/70">
            Refer &amp; earn
          </SectionLabel>
          <h2 className="mb-4 font-display text-[40px] leading-[1.0] text-void uppercase sm:text-[52px] xl:text-[62px]">
            &#8377;{REFERRAL_REWARD} for them.
            <br />
            &#8377;{REFERRAL_REWARD} for you.
          </h2>
          <p className="max-w-[520px] text-[15.5px] leading-[1.58] text-void/85 sm:text-[16.5px]">
            Send your code to the group chat. They save &#8377;{REFERRAL_REWARD} on their first
            mount, you get &#8377;{REFERRAL_REWARD} back the moment it ships. No cap, no expiry.
          </p>
        </div>

        <div className="flex shrink-0 flex-col gap-3">
          <div className="flex items-center gap-3.5 rounded-xl border border-dashed border-bone/35 bg-void/90 px-5 py-4">
            <span className="font-mono text-[11px] tracking-[0.16em] text-dim">YOUR CODE</span>
            <span className="font-display leading-[1.08] text-[24px] tracking-[0.12em] text-acid sm:text-[26px]">
              SKULL-8F2K
            </span>
          </div>
          <ButtonLink
            href="/refer"
            variant="light"
            size="md"
            className="bg-void text-bone hover:bg-graphite"
          >
            <Share2 className="size-4" strokeWidth={2} />
            Share &amp; earn
          </ButtonLink>
        </div>
      </div>
    </section>
  )
}
