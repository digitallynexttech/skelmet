import Image from "next/image"
import Link from "next/link"

import { FAQ_ITEMS } from "@/components/marketing/content"
import { Section } from "@/components/marketing/section"
import { SectionLabel } from "@/components/shared/section-label"
import { Accordion } from "@/components/ui/accordion"

export function FaqSection() {
  return (
    <Section id="faq">
      <div className="grid gap-10 lg:grid-cols-[400px_minmax(0,1fr)] lg:gap-16">
        <div>
          <SectionLabel index="15" className="mb-3.5">
            Questions
          </SectionLabel>
          <h2 className="mb-5 font-display text-[38px] leading-[1.04] text-bone uppercase sm:text-[48px] xl:text-[58px]">
            Before you
            <br />
            ask us
          </h2>
          <p className="mb-7 text-[15.5px] leading-[1.6] text-ash">
            Still stuck?{" "}
            <Link href="/contact" className="border-b border-acid/40 text-acid hover:text-bone">
              Message us
            </Link>{" "}
            and we answer within a working day.
          </p>
          <div className="relative hidden aspect-4/3 overflow-hidden rounded-tile border border-white/[0.08] lg:block">
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
