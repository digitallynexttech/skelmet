import Image from "next/image"
import Link from "next/link"

import { faqItems } from "@/components/marketing/content"
import { Section } from "@/components/marketing/section"
import { SectionLabel } from "@/components/shared/section-label"
import { Accordion } from "@/components/ui/accordion"
import { siteConfig } from "@/config/site"
import { FLAME_SKULL_MOUNT, type FaqAnswers, type Picture } from "@/features/catalog/catalog"
import { paymentCopy } from "@/features/checkout/payment-options"
import { paymentOptions } from "@/features/settings/server/runtime-settings"

/**
 * Async only for the paying answer, which states the ways to pay switched on in the console;
 * a save there refreshes these prerendered pages (refreshPaymentTerms).
 * An `answers` entry of null leaves its question out.
 */
export async function FaqSection({
  picture = FLAME_SKULL_MOUNT.sections.faq,
  answers = {},
}: { picture?: Picture; answers?: FaqAnswers } = {}) {
  const items = faqItems(paymentCopy(await paymentOptions()).faq).flatMap((item) => {
    const own = answers[item.question]
    if (own === null) return []
    return [own === undefined ? item : { ...item, answer: own }]
  })

  // Carbon band here: other sections build their cards from bg-carbon and would vanish on it.
  return (
    <Section id="faq" className="bg-carbon border-t border-white/[0.07]">
      {/* 460px from xl keeps the heading on one line. */}
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
          {/* Square, like the picture, so nothing is cropped. */}
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
