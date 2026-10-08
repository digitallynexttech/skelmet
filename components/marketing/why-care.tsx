import Image from "next/image"

import { WHY_CARE } from "@/components/marketing/content"
import { Section, SectionHeading } from "@/components/marketing/section"
import { SectionLabel } from "@/components/shared/section-label"

/**
 * The problem, before the product: magenta, as the one section not selling anything.
 * The picture is generated and shows no SKELMET, so it cannot show the mount wrong.
 */
export function WhyCare() {
  return (
    <Section className="bg-carbon border-y border-white/[0.07]">
      <SectionLabel numbered tone="magenta" className="mb-3.5">
        The problem
      </SectionLabel>
      <SectionHeading className="mb-10 max-w-[900px] sm:mb-12">
        Why not give your gear the same love as your bike?
      </SectionHeading>

      <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14">
        <div className="rounded-card relative aspect-4/3 overflow-hidden border border-white/[0.08]">
          <Image
            src="/product/problem-shoe-rack.jpg"
            alt="A scratched full-face helmet left on the floor by a shoe rack, a riding glove dropped beside it"
            fill
            sizes="(min-width: 1024px) 45vw, 92vw"
            className="object-cover"
          />
        </div>

        <ol className="flex flex-col">
          {WHY_CARE.map(({ kicker, body }, i) => (
            <li
              key={kicker}
              className="flex gap-5 border-t border-white/[0.08] py-6 first:border-t-0 first:pt-0 last:pb-0 sm:gap-6"
            >
              <span className="font-display text-magenta w-11 shrink-0 text-[34px] leading-none">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <h3 className="text-bone mb-1.5 text-[19px] font-semibold sm:text-[21px]">
                  {kicker}
                </h3>
                <p className="text-ash text-[15.5px] leading-[1.65] sm:text-[16.5px]">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </Section>
  )
}
