import Image from "next/image"

import { Section } from "@/components/marketing/section"
import { SectionLabel } from "@/components/shared/section-label"
import { FLAME_SKULL_MOUNT, type Product } from "@/features/catalog/catalog"
import { cn } from "@/lib/utils"

/** The build of the skull the page sells: the Flame Skull's unless given. */
export function Anatomy({ product = FLAME_SKULL_MOUNT }: { product?: Product } = {}) {
  const { picture, body } = product.sections.build
  return (
    <Section id="build" className="grain">
      <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_520px] lg:gap-16">
        <div className="rounded-card bg-carbon overflow-hidden border border-white/[0.08]">
          <div className="relative aspect-16/10">
            <Image
              src={picture.src}
              alt={picture.alt}
              style={{ objectPosition: picture.position }}
              fill
              // Its real width: the page less its gutters, the 520px text
              // column and the 64px gap beside it; full width less gutters
              // when stacked. At 90, as the card's print and the table's grain
              // went soft at the default 75.
              sizes="(min-width: 1280px) calc(100vw - 696px), (min-width: 1024px) calc(100vw - 648px), (min-width: 640px) calc(100vw - 64px), calc(100vw - 40px)"
              quality={90}
              className="object-cover"
            />
          </div>
        </div>

        <div>
          <SectionLabel numbered className="mb-3.5">
            The build
          </SectionLabel>
          <h2 className="font-display text-bone mb-5 text-[40px] leading-[1.0] uppercase sm:text-[52px] xl:text-[62px]">
            Simple yet solid
          </h2>
          <p className="text-ash mb-8 max-w-[460px] text-[16px] leading-[1.62] text-pretty sm:text-[16.5px]">
            {body}
          </p>

          <dl className="flex flex-col border-t border-white/[0.09]">
            {product.specs.map((spec) => (
              <div
                key={spec.label}
                className="flex items-center justify-between gap-4 border-b border-white/[0.09] py-3.5 font-mono text-[12.5px] sm:text-[13px]"
              >
                <dt className="text-dim tracking-[0.1em] uppercase">{spec.label}</dt>
                <dd className={cn("text-right", spec.pending ? "text-ember" : "text-bone")}>
                  {spec.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </Section>
  )
}
