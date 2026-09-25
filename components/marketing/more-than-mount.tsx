import { Eye, KeyRound, ShieldCheck } from "lucide-react"

import { MORE_THAN_MOUNT } from "@/components/marketing/content"
import { Section, SectionHeading } from "@/components/marketing/section"
import { SectionLabel } from "@/components/shared/section-label"

/**
 * The answer to the section above it, so it reads as a reply rather than a
 * fresh pitch: same three-up grid, acid instead of magenta.
 */
const ICONS = [KeyRound, Eye, ShieldCheck]

export function MoreThanMount() {
  return (
    <Section>
      <SectionLabel numbered tone="acid" className="mb-3.5">
        What it actually does
      </SectionLabel>
      <SectionHeading className="mb-10 max-w-[820px] sm:mb-12">
        It&rsquo;s more than just a helmet mount
      </SectionHeading>

      <div className="grid gap-4 md:grid-cols-3">
        {MORE_THAN_MOUNT.map(({ title, body }, i) => {
          const Icon = ICONS[i] ?? ShieldCheck
          return (
            <div
              key={title}
              className="rounded-tile bg-carbon flex flex-col gap-4 border border-white/[0.08] p-6 sm:p-7"
            >
              <span className="border-acid/25 bg-acid/[0.08] grid size-10 place-items-center rounded-full border">
                <Icon className="text-ember size-[18px]" strokeWidth={1.8} />
              </span>
              <div>
                <h3 className="font-display text-bone mb-2.5 text-[20px] leading-[1.15] uppercase">
                  {title}
                </h3>
                <p className="text-ash text-[14.5px] leading-[1.6]">{body}</p>
              </div>
            </div>
          )
        })}
      </div>
    </Section>
  )
}
