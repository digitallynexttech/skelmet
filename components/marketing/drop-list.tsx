import Image from "next/image"

import { SectionLabel } from "@/components/shared/section-label"
import { DropListForm } from "@/features/newsletter/components/drop-list-form"

export function DropList() {
  return (
    <section className="grid border-t border-white/[0.07] lg:grid-cols-2">
      <div className="relative min-h-[260px] lg:min-h-[380px]">
        <Image
          src="/product/colourway-lineup.jpg"
          alt="All three SKELMET colourways lined up"
          fill
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="object-cover"
        />
        {/* No skull dock here: the hero skull's route ends at The build. */}
      </div>
      <div className="bg-carbon flex flex-col justify-center px-5 py-14 sm:px-8 sm:py-16 xl:px-14">
        <SectionLabel numbered tone="violet" className="mb-4">
          Next drop
        </SectionLabel>
        <h2 className="font-display text-bone mb-4 text-[34px] leading-[1.04] uppercase sm:text-[44px] xl:text-[50px]">
          Want some more?
        </h2>
        <p className="text-ash mb-7 max-w-[420px] text-[15px] leading-[1.6] sm:text-[15.5px]">
          New designs and colourways are dropping soon, and the good ones sell out fast. Be the
          first to know.
        </p>
        <DropListForm />
      </div>
    </section>
  )
}
