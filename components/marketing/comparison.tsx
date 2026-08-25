import { ArrowRight } from "lucide-react"

import { COMPARISON_ROWS } from "@/components/marketing/content"
import { Section, SectionHeading } from "@/components/marketing/section"
import { SectionLabel } from "@/components/shared/section-label"

export function Comparison() {
  return (
    <Section>
      <SectionLabel index="07" className="mb-3.5">
        The alternatives
      </SectionLabel>
      <SectionHeading className="mb-10 sm:mb-12">Or you could keep doing this</SectionHeading>

      {/* Scrollbars are hidden globally, so say out loud that this one moves. */}
      <div className="mb-3 flex items-center gap-2 font-mono text-[10.5px] tracking-[0.16em] text-dim uppercase lg:hidden">
        Swipe to compare
        <ArrowRight className="size-3.5" strokeWidth={2} />
      </div>

      {/* Scrolls inside its own container so the page never scrolls sideways. */}
      <div className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
        <div className="min-w-[720px] overflow-hidden rounded-card border border-white/[0.09]">
          <div className="grid grid-cols-[180px_repeat(3,minmax(0,1fr))] border-b border-white/[0.07] bg-carbon">
            <div className="px-5 py-5" />
            <div className="border-l border-white/[0.07] px-5 py-5 font-display leading-[1.12] text-[20px] text-dim uppercase">
              The floor
            </div>
            <div className="border-l border-white/[0.07] px-5 py-5 font-display leading-[1.12] text-[20px] text-dim uppercase">
              A steel hook
            </div>
            <div className="border-l border-blaze/30 bg-[linear-gradient(160deg,rgb(255_90_31_/_0.14),transparent_70%)] px-5 py-5 font-display leading-[1.12] text-[20px] text-blaze uppercase">
              SKELMET
            </div>
          </div>

          {COMPARISON_ROWS.map((row) => (
            <div
              key={row.label}
              className="grid grid-cols-[180px_repeat(3,minmax(0,1fr))] border-b border-white/[0.07] last:border-b-0"
            >
              <div className="px-5 py-4 text-[14px] text-ash">{row.label}</div>
              <div className="border-l border-white/[0.07] px-5 py-4 text-[14px] text-magenta">
                {row.floor}
              </div>
              <div className="border-l border-white/[0.07] px-5 py-4 text-[14px] text-ash">
                {row.hook}
              </div>
              <div className="border-l border-blaze/30 px-5 py-4 text-[14px] text-acid">{row.us}</div>
            </div>
          ))}
        </div>
      </div>
    </Section>
  )
}
