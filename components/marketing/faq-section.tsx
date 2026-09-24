import Image from "next/image"
import Link from "next/link"

import { FAQ_ITEMS } from "@/components/marketing/content"
import { Section } from "@/components/marketing/section"
import { SectionLabel } from "@/components/shared/section-label"
import { Accordion } from "@/components/ui/accordion"

export function FaqSection() {
  // Carbon, like rider-wall. The homepage has only one other darker band, so
  // without this one its last three sections run flat into each other. It is
  // also the only
  // section that can take it without losing anything - every other candidate
  // builds its cards out of bg-carbon, which would have dissolved them into
  // the panel behind.
  return (
    <Section id="faq" className="bg-carbon border-t border-white/[0.07]">
      <div className="grid gap-10 lg:grid-cols-[400px_minmax(0,1fr)] lg:gap-16">
        <div>
          <SectionLabel numbered className="mb-3.5">
            Questions
          </SectionLabel>
          <h2 className="font-display text-bone mb-5 text-[38px] leading-[1.04] uppercase sm:text-[48px] xl:text-[58px]">
            Before you
            <br />
            ask us
          </h2>
          <p className="text-ash mb-7 text-[15.5px] leading-[1.6]">
            Still stuck?{" "}
            <Link href="/contact" className="border-acid/40 text-acid hover:text-bone border-b">
              Message us
            </Link>{" "}
            and we answer within a working day.
          </p>
          <div className="rounded-tile relative hidden aspect-4/3 overflow-hidden border border-white/[0.08] lg:block">
            <Image
              src="/product/product-profile.jpg"
              alt="Side profile of the SKELMET mount"
              fill
              sizes="360px"
              className="object-cover"
            />
          </div>
        </div>

        <Accordion items={FAQ_ITEMS} />
      </div>
    </Section>
  )
}
