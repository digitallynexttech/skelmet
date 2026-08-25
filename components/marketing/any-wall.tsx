import Image from "next/image"

import { SectionLabel } from "@/components/shared/section-label"

export function AnyWall() {
  return (
    <section className="relative min-h-[420px] overflow-hidden border-t border-white/[0.07] lg:h-[520px]">
      <Image
        src="/product/lifestyle-garage.jpg"
        alt="A SKELMET mount on a workshop wall at night"
        fill
        sizes="100vw"
        className="object-cover object-[60%_50%]"
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(7_6_10_/_0.9)_0%,rgb(7_6_10_/_0.75)_60%,rgb(7_6_10_/_0.55)_100%)] lg:bg-[linear-gradient(90deg,rgb(7_6_10_/_0.97)_0%,rgb(7_6_10_/_0.88)_34%,rgb(7_6_10_/_0.1)_68%)]" />
      <div className="relative z-10 flex h-full flex-col justify-center px-5 py-16 sm:px-8 lg:w-[620px] lg:py-0 lg:pl-14">
        <SectionLabel index="12" tone="acid" className="mb-4">
          Any wall
        </SectionLabel>
        <h2 className="mb-5 font-display text-[40px] leading-[1.0] text-bone uppercase sm:text-[52px] xl:text-[66px]">
          Bedroom.
          <br />
          Garage. Hallway.
        </h2>
        <p className="max-w-[460px] text-[15.5px] leading-[1.6] text-[#c9c6d4] sm:text-[17px]">
          Brick, plaster, drywall or concrete, the anchors in the box cover all four. It looks
          equally at home over a workbench and next to a houseplant.
        </p>
      </div>
    </section>
  )
}
