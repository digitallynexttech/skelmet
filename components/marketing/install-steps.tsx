import Image from "next/image"

import { INSTALL_STEPS } from "@/components/marketing/content"
import { Section } from "@/components/marketing/section"
import { SectionLabel } from "@/components/shared/section-label"
import { cn } from "@/lib/utils"

export function InstallSteps() {
  return (
    <Section id="install" className="bg-carbon border-y border-white/[0.07]">
      <div className="grid items-center gap-10 lg:grid-cols-[560px_minmax(0,1fr)] lg:gap-14">
        <div className="rounded-card overflow-hidden border border-white/[0.08]">
          <div className="relative aspect-3/2">
            <Image
              src="/product/install-drill.jpg"
              alt="Fitting the SKELMET bracket to a wall with a drill"
              fill
              sizes="(min-width: 1024px) 45vw, 92vw"
              className="object-cover"
            />
          </div>
        </div>

        <div>
          <SectionLabel numbered tone="acid" className="mb-3.5">
            Install
          </SectionLabel>
          <h2 className="font-display text-bone mb-8 text-[38px] leading-[1.04] uppercase sm:text-[48px] xl:text-[58px]">
            Wall to skull
            <br />
            in ten minutes
          </h2>

          <ol className="grid gap-3.5 sm:grid-cols-2">
            {INSTALL_STEPS.map((step, i) => {
              const last = i === INSTALL_STEPS.length - 1
              return (
                <li
                  key={step.n}
                  className={cn(
                    "rounded-tile bg-void border p-5 sm:p-6",
                    last
                      ? "border-blaze/35 bg-[linear-gradient(150deg,rgb(255_90_31_/_0.12),transparent_62%)]"
                      : "border-white/[0.09]",
                  )}
                >
                  <div
                    className={cn(
                      "font-display mb-3 text-[32px] leading-none sm:text-[34px]",
                      last ? "text-blaze" : "text-blaze/40",
                    )}
                  >
                    {step.n}
                  </div>
                  <h3 className="text-bone mb-1.5 text-[15.5px] font-bold sm:text-base">
                    {step.title}
                  </h3>
                  <p className="text-ash text-[13px] leading-[1.52] sm:text-[13.5px]">
                    {step.body}
                  </p>
                </li>
              )
            })}
          </ol>
        </div>
      </div>
    </Section>
  )
}
