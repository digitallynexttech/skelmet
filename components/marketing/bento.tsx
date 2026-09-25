import Image from "next/image"
import { Boxes, ShieldCheck, Wind, Wrench } from "lucide-react"

import { Section, SectionHeading } from "@/components/marketing/section"
import { SectionLabel } from "@/components/shared/section-label"

/**
 * Five reasons across a 4x3 grid, which fills exactly: the image hero takes
 * 2x2, two icon tiles sit beside it, a wider one takes the rest of that row,
 * and the accessories band runs the full width underneath. The previous
 * six-tile arrangement left the bottom-right two cells empty.
 */
export function Bento() {
  return (
    <Section>
      <SectionLabel numbered className="mb-3.5">
        Why it slaps
      </SectionLabel>
      <SectionHeading className="mb-10 sm:mb-12">Made for a Reason.</SectionHeading>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:grid-rows-[repeat(3,220px)]">
        {/* Hero tile */}
        <article className="rounded-card border-blaze/30 relative col-span-2 min-h-[300px] overflow-hidden border lg:row-span-2 lg:min-h-0">
          <Image
            src="/product/lifestyle-garage.jpg"
            alt="A SKELMET mount bolted to a workshop wall"
            fill
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-[linear-gradient(0deg,rgb(7_6_10_/_0.96)_8%,rgb(7_6_10_/_0.5)_48%,rgb(7_6_10_/_0.1)_100%)]" />
          <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
            <h3 className="font-display text-bone mb-2.5 text-[28px] leading-[1.04] uppercase sm:text-[38px]">
              Store in style
            </h3>
            <p className="max-w-[420px] text-[13.5px] leading-[1.56] text-[#c9c6d4] sm:text-[14.5px]">
              Bedroom, Garage, Living room; wherever you mount it, it catches eyes, commands
              attention and makes a statement.
            </p>
          </div>
        </article>

        <article className="rounded-card bg-carbon flex flex-col justify-between gap-6 border border-white/[0.09] p-5 sm:p-6">
          <Wrench className="text-acid size-[26px]" strokeWidth={1.6} />
          <div>
            <h3 className="font-display text-bone mb-2 text-[20px] leading-[1.08] uppercase sm:text-[23px]">
              Simple installation
            </h3>
            <p className="text-ash text-[13px] leading-[1.52] sm:text-[13.5px]">
              Screw the mount arm into the wall, and you are done.
            </p>
          </div>
        </article>

        <article className="rounded-card bg-carbon flex flex-col justify-between gap-6 border border-white/[0.09] p-5 sm:p-6">
          <ShieldCheck className="text-violet size-[26px]" strokeWidth={1.6} />
          <div>
            <h3 className="font-display text-bone mb-2 text-[20px] leading-[1.08] uppercase sm:text-[23px]">
              Safeguard your equipment
            </h3>
            <p className="text-ash text-[13px] leading-[1.52] sm:text-[13.5px]">
              Floors and shelves wear your helmet down over time with dust, scratches, and scuffs.
              A wall mount doesn&apos;t.
            </p>
          </div>
        </article>

        <article className="rounded-card bg-carbon col-span-2 flex flex-col justify-between gap-6 border border-white/[0.09] p-5 sm:p-6">
          <Wind className="text-ember size-[26px]" strokeWidth={1.6} />
          <div>
            <h3 className="font-display text-bone mb-2 text-[20px] leading-[1.08] uppercase sm:text-[23px]">
              Keep it clean
            </h3>
            <p className="text-ash max-w-[460px] text-[13px] leading-[1.52] sm:text-[13.5px]">
              Sweat builds up in padding if the helmet is left closed up. Mounting keeps the helmet
              open, so it dries faster and stays fresh.
            </p>
          </div>
        </article>

        <article className="rounded-card relative col-span-2 min-h-[200px] overflow-hidden border border-white/[0.09] lg:col-span-4">
          <Image
            src="/product/lifestyle-gloves.jpg"
            alt="Riding gloves hanging from the hook under the mount"
            fill
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgb(7_6_10_/_0.94)_4%,rgb(7_6_10_/_0.55)_52%,rgb(7_6_10_/_0.05)_100%)]" />
          <div className="absolute inset-y-0 left-0 flex w-[68%] flex-col justify-center gap-2 p-5 sm:p-7 lg:w-[52%]">
            <div className="flex items-center gap-2.5">
              <Boxes className="text-magenta size-[22px] shrink-0" strokeWidth={1.6} />
              <h3 className="font-display text-bone text-[20px] leading-[1.08] uppercase sm:text-[24px]">
                The accessories station
              </h3>
            </div>
            <p className="text-[13px] leading-[1.52] text-[#c9c6d4] sm:text-[13.5px]">
              Hooks on the mount arm hold your riding gloves, riding jacket and keys. Let this be
              the one-stop for all your riding gear.
            </p>
          </div>
        </article>
      </div>
    </Section>
  )
}
