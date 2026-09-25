import { Droplets, Footprints, ShieldAlert } from "lucide-react"

import { WHY_CARE } from "@/components/marketing/content"
import { Section, SectionHeading } from "@/components/marketing/section"
import { SectionLabel } from "@/components/shared/section-label"

/**
 * The problem, before the product. Magenta throughout, because this is the
 * one section on the page that is not selling anything - it is describing
 * what already happens to a helmet that lives on the floor.
 */
const ICONS = [Footprints, Droplets, ShieldAlert]

export function WhyCare() {
  return (
    <Section className="bg-carbon border-y border-white/[0.07]">
      <SectionLabel numbered tone="magenta" className="mb-3.5">
        The problem
      </SectionLabel>
      <SectionHeading className="mb-10 max-w-[900px] sm:mb-12">
        Why not give your helmet the same love as your bike?
      </SectionHeading>

      <div className="grid gap-4 md:grid-cols-3">
        {WHY_CARE.map(({ kicker, body }, i) => {
          const Icon = ICONS[i] ?? ShieldAlert
          return (
            <div
              key={kicker}
              className="rounded-tile bg-void flex flex-col gap-4 border border-white/[0.08] p-6 sm:p-7"
            >
              <span className="border-magenta/25 bg-magenta/[0.08] grid size-10 place-items-center rounded-full border">
                <Icon className="text-ember size-[18px]" strokeWidth={1.8} />
              </span>
              <div>
                <p className="text-magenta mb-2 font-mono text-[10.5px] tracking-[0.18em] uppercase">
                  {kicker}
                </p>
                <p className="text-ash text-[14.5px] leading-[1.6]">{body}</p>
              </div>
            </div>
          )
        })}
      </div>
    </Section>
  )
}
