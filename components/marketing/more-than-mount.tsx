import Image from "next/image"

import { MORE_THAN_MOUNT } from "@/components/marketing/content"
import { Section, SectionHeading } from "@/components/marketing/section"
import { SectionLabel } from "@/components/shared/section-label"
import { FLAME_SKULL_MOUNT, type ProductSections } from "@/features/catalog/catalog"

/**
 * The answer to the section above it, so it reads as a reply rather than a
 * fresh pitch: three cards, acid instead of magenta, each led by a picture
 * of the point it makes - of the skull the page sells (catalog.ts).
 */
export function MoreThanMount({
  shots = FLAME_SKULL_MOUNT.sections.inUse,
}: { shots?: ProductSections["inUse"] } = {}) {
  return (
    <Section>
      <SectionLabel numbered tone="acid" className="mb-3.5">
        What it actually does
      </SectionLabel>
      <SectionHeading className="mb-10 max-w-[820px] sm:mb-12">
        It&rsquo;s more than just a helmet mount
      </SectionHeading>

      <div className="grid gap-5 md:grid-cols-3">
        {MORE_THAN_MOUNT.map(({ title, body }, i) => {
          const shot = shots[i]
          return (
            <article
              key={title}
              className="rounded-card bg-carbon flex flex-col overflow-hidden border border-white/[0.08]"
            >
              {shot ? (
                <div className="relative aspect-square">
                  <Image
                    src={shot.src}
                    alt={shot.alt}
                    fill
                    sizes="(min-width: 768px) 32vw, 92vw"
                    className="object-cover"
                  />
                </div>
              ) : null}
              <div className="border-acid/40 border-t-2 p-6 sm:p-7">
                <h3 className="font-display text-bone mb-2.5 text-[22px] leading-[1.1] uppercase sm:text-[24px]">
                  {title}
                </h3>
                <p className="text-ash text-[15.5px] leading-[1.65]">{body}</p>
              </div>
            </article>
          )
        })}
      </div>
    </Section>
  )
}
