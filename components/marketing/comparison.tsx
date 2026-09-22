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
      <div className="text-dim mb-3 flex items-center gap-2 font-mono text-[10.5px] tracking-[0.16em] uppercase lg:hidden">
        Swipe to compare
        <ArrowRight className="size-3.5" strokeWidth={2} />
      </div>

      {/* Scrolls inside its own container so the page never scrolls sideways. */}
      <div className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
        <div className="rounded-card min-w-[720px] overflow-hidden border border-white/[0.09]">
          <div className="bg-carbon grid grid-cols-[180px_repeat(3,minmax(0,1fr))] border-b border-white/[0.07]">
            <div className="px-5 py-5" />
            <div className="font-display text-dim border-l border-white/[0.07] px-5 py-5 text-[20px] leading-[1.12] uppercase">
              The floor
            </div>
            <div className="font-display text-dim border-l border-white/[0.07] px-5 py-5 text-[20px] leading-[1.12] uppercase">
              A steel hook
            </div>
            <div className="border-blaze/30 font-display text-blaze border-l bg-[linear-gradient(160deg,rgb(255_90_31_/_0.14),transparent_70%)] px-5 py-5 text-[20px] leading-[1.12] uppercase">
              SKELMET
            </div>
          </div>

          {COMPARISON_ROWS.map((row) => (
            <div
              key={row.label}
              className="grid grid-cols-[180px_repeat(3,minmax(0,1fr))] border-b border-white/[0.07] last:border-b-0"
            >
              <div className="text-ash px-5 py-4 text-[14px]">{row.label}</div>
              <div className="text-magenta border-l border-white/[0.07] px-5 py-4 text-[14px]">
                {row.floor}
              </div>
              <div className="text-ash border-l border-white/[0.07] px-5 py-4 text-[14px]">
                {row.hook}
              </div>
              <div className="border-blaze/30 text-acid border-l px-5 py-4 text-[14px]">
                {row.us}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Section>
  )
}
