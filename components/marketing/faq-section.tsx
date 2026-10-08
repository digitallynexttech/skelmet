import Image from "next/image"
import Link from "next/link"

import { faqItems } from "@/components/marketing/content"
import { Section } from "@/components/marketing/section"
import { SectionLabel } from "@/components/shared/section-label"
import { Accordion } from "@/components/ui/accordion"
import { siteConfig } from "@/config/site"
import { paymentCopy } from "@/features/checkout/payment-options"
import { paymentOptions } from "@/features/settings/server/runtime-settings"

/**
 * Async only for the question on paying, which states the ways to pay
 * switched on in the console. The pages it sits on are prerendered, and a
 * save there refreshes them (refreshPaymentTerms).
 */
const FLAME_PICTURE = {
  src: "/product/gallery-bare-skull-ghost-grey.jpg",
  alt: "The SKELMET mount in Ghost Grey on its black arm, gloves hanging from the hook",
}

/** `picture`: the skull this page sells, the Flame Skull's unless given. */
export async function FaqSection({
  picture = FLAME_PICTURE,
}: { picture?: { src: string; alt: string } } = {}) {
  const items = faqItems(paymentCopy(await paymentOptions()).faq)

  // Carbon, like rider-wall. The homepage has only one other darker band, so
  // without this one its last three sections run flat into each other. It is
  // also the only
  // section that can take it without losing anything - every other candidate
  // builds its cards out of bg-carbon, which would have dissolved them into
  // the panel behind.
  return (
    <Section id="faq" className="bg-carbon border-t border-white/[0.07]">
      {/* 460px from xl: the heading is 446px wide at 58px (Anton), on one line. */}
      <div className="grid gap-10 lg:grid-cols-[400px_minmax(0,1fr)] lg:gap-16 xl:grid-cols-[460px_minmax(0,1fr)]">
        <div>
          <SectionLabel numbered className="mb-3.5">
            Questions
          </SectionLabel>
          <h2 className="font-display text-bone mb-5 text-[38px] leading-[1.04] uppercase sm:text-[48px] xl:text-[58px]">
            Before you ask us
          </h2>
          <p className="text-ash mb-7 text-[15.5px] leading-[1.6]">
            Still stuck?{" "}
            <Link href="/contact" className="border-acid/40 text-acid hover:text-bone border-b">
              Message us
            </Link>{" "}
            and we reply within {siteConfig.promise.supportReply}.
          </p>
          {/* Square, like the picture: the skull, its arm and the gloves on its
              hook, with nothing cropped off. */}
          <div className="rounded-tile relative hidden aspect-square overflow-hidden border border-white/[0.08] lg:block">
            <Image
              src={picture.src}
              alt={picture.alt}
              fill
              sizes="(min-width: 1280px) 460px, 400px"
              className="object-cover"
            />
          </div>
        </div>

        <Accordion items={items} />
      </div>
    </Section>
  )
}
