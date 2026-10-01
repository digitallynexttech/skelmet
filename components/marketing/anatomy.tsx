import Image from "next/image"

import { Section } from "@/components/marketing/section"
import { SkullDock } from "@/components/marketing/skull-dock"
import { SectionLabel } from "@/components/shared/section-label"
import { FLAME_SKULL_MOUNT } from "@/features/catalog/catalog"
import { cn } from "@/lib/utils"

export function Anatomy() {
  return (
    <Section id="build" className="grain">
      <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_520px] lg:gap-16">
        <div className="rounded-card bg-carbon overflow-hidden border border-white/[0.08]">
          <div className="relative aspect-16/10">
            <Image
              src="/product/box-contents.jpg"
              alt="What comes in the box: the flame skull on its arm in one piece, a paper drilling guide marking the three holes, three screws and wall plugs, a thank-you card and a mystery box"
              fill
              sizes="(min-width: 1024px) 55vw, 92vw"
              className="object-cover"
            />
            {/* The hero skull's last stop on desktop (phones end at the lineup):
                it lands on the mount here and stays. The shot is a
                profile facing left, so it lands turned a quarter to match, and
                it is taken from straight above, so the skull does not nod. The
                mount lies turned 7° face-up, as the 3D model is built, so the
                landed skull sits on its post exactly. */}
            <SkullDock
              src="/product/box-contents.jpg"
              sizes="(min-width: 1024px) 55vw, 92vw"
              turn={-Math.PI / 2}
              pitch={0}
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
            The mount arm fixes to the wall with 3 screws. The skull is shaped to fit into any
            helmet type and size. The whole mount supports up to 10 kg.
          </p>

          <dl className="flex flex-col border-t border-white/[0.09]">
            {FLAME_SKULL_MOUNT.specs.map((spec) => (
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
