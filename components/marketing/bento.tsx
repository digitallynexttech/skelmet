import Image from "next/image"
import { Boxes, Clock, Gift, Wind } from "lucide-react"

import { Section, SectionHeading } from "@/components/marketing/section"
import { SectionLabel } from "@/components/shared/section-label"
import { COLOURWAYS } from "@/features/catalog/catalog"

export function Bento() {
  return (
    <Section>
      <SectionLabel index="05" className="mb-3.5">
        Why it slaps
      </SectionLabel>
      <SectionHeading className="mb-10 sm:mb-12">Six reasons, no fluff</SectionHeading>

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
              Printed to order,
              <br />
              not stockpiled
            </h3>
            <p className="max-w-[380px] text-[13.5px] leading-[1.56] text-[#c9c6d4] sm:text-[14.5px]">
              Every skull comes off our own printers in small batches. Nothing sits in a warehouse
              for eight months waiting for you.
            </p>
          </div>
        </article>

        <article className="rounded-card bg-carbon flex flex-col justify-between gap-6 border border-white/[0.09] p-5 sm:p-6">
          <Boxes className="text-acid size-[26px]" strokeWidth={1.6} />
          <div>
            <h3 className="font-display text-bone mb-2 text-[20px] leading-[1.08] uppercase sm:text-[23px]">
              Glove hook
            </h3>
            <p className="text-ash text-[13px] leading-[1.52] sm:text-[13.5px]">
              Notch under the jaw takes gloves, keys or a jacket loop.
            </p>
          </div>
        </article>

        <article className="rounded-card bg-carbon flex flex-col justify-between gap-6 border border-white/[0.09] p-5 sm:p-6">
          <Clock className="text-violet size-[26px]" strokeWidth={1.6} />
          <div>
            <h3 className="font-display text-bone mb-2 text-[20px] leading-[1.08] uppercase sm:text-[23px]">
              10-min fit
            </h3>
            <p className="text-ash text-[13px] leading-[1.52] sm:text-[13.5px]">
              Paper drill template in the box. Four screws, done.
            </p>
          </div>
        </article>

        <article className="rounded-card relative col-span-2 min-h-[200px] overflow-hidden border border-white/[0.09]">
          <Image
            src="/product/lifestyle-room.jpg"
            alt="A SKELMET mount on a bedroom wall"
            fill
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgb(7_6_10_/_0.94)_4%,rgb(7_6_10_/_0.55)_52%,rgb(7_6_10_/_0.05)_100%)]" />
          <div className="absolute inset-y-0 left-0 flex w-[68%] flex-col justify-center gap-2 p-5 sm:p-7">
            <div className="flex items-center gap-2.5">
              <Wind className="text-ember size-[22px] shrink-0" strokeWidth={1.6} />
              <h3 className="font-display text-bone text-[20px] leading-[1.08] uppercase sm:text-[24px]">
                Dries the liner out
              </h3>
            </div>
            <p className="text-[13px] leading-[1.52] text-[#c9c6d4] sm:text-[13.5px]">
              Off the floor and open to the air, so the padding isn&apos;t damp when you leave in
              the morning.
            </p>
          </div>
        </article>

        <article className="rounded-card bg-carbon flex flex-col justify-between gap-6 border border-white/[0.09] p-5 sm:p-6">
          <div className="flex gap-1.5">
            {COLOURWAYS.map((c) => (
              <span
                key={c.id}
                className="size-[15px] rounded-full"
                style={{ backgroundColor: c.hex }}
              />
            ))}
          </div>
          <div>
            <h3 className="font-display text-bone mb-2 text-[20px] leading-[1.08] uppercase sm:text-[23px]">
              3 colourways
            </h3>
            <p className="text-ash text-[13px] leading-[1.52] sm:text-[13.5px]">
              Custom colour on request from five units.
            </p>
          </div>
        </article>

        <article className="rounded-card border-magenta/30 bg-carbon flex flex-col justify-between gap-6 border bg-[linear-gradient(160deg,rgb(255_61_154_/_0.12),transparent_62%)] p-5 sm:p-6">
          <Gift className="text-magenta size-[26px]" strokeWidth={1.6} />
          <div>
            <h3 className="font-display text-bone mb-2 text-[20px] leading-[1.08] uppercase sm:text-[23px]">
              Actual gift
            </h3>
            <p className="text-ash text-[13px] leading-[1.52] sm:text-[13.5px]">
              The only biker gift that isn&apos;t another keychain.
            </p>
          </div>
        </article>
      </div>
    </Section>
  )
}
