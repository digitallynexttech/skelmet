import Image from "next/image"
import { ArrowRight, Play } from "lucide-react"

import { Stars } from "@/components/shared/stars"
import { ButtonLink } from "@/components/ui/button"
import { FLAME_SKULL_MOUNT } from "@/features/catalog/catalog"
import { formatMoney } from "@/lib/money"
import { cn } from "@/lib/utils"

const CHIPS = [
  { dot: "bg-blaze", label: "MATTE PLA+ FINISH" },
  { dot: "bg-acid", label: "GLOVE HOOK BUILT IN" },
  { dot: "bg-violet", label: "FULL & OPEN FACE" },
  { dot: "bg-magenta", label: "10-MINUTE INSTALL" },
]

const EMBERS = [
  "left-[38%] bottom-[24%] size-1 [animation-delay:0s]",
  "left-[55%] bottom-[20%] size-[3px] [animation-delay:2.8s]",
  "left-[64%] bottom-[28%] size-1 [animation-delay:5.6s]",
]

/**
 * The product plate is a photograph on pure black; `mix-blend-mode: screen`
 * drops that black into the page background, so no cutout PNG is needed and
 * the ember haze in the shot survives.
 */
function SkullStage({ className, priority = false }: { className?: string; priority?: boolean }) {
  return (
    <div className={cn("relative", className)}>
      <div className="absolute top-1/2 left-1/2 size-[62%] -translate-x-1/2 -translate-y-1/2 animate-bloom rounded-full bg-[radial-gradient(circle,rgb(255_90_31_/_0.4),transparent_68%)] blur-[40px]" />
      <div className="absolute top-1/2 left-1/2 size-[92%] -translate-x-1/2 -translate-y-1/2 animate-spin-rev rounded-full border border-dashed border-blaze/25" />
      <div className="conic-orbit absolute top-1/2 left-1/2 size-[78%] -translate-x-1/2 -translate-y-1/2 animate-spin-slow rounded-full" />

      <Image
        src="/product/hero-skull.jpg"
        alt="SKELMET blaze orange flame skull helmet mount"
        fill
        priority={priority}
        sizes="(min-width: 1024px) 58vw, 100vw"
        className="screen animate-drift object-cover object-[50%_48%]"
      />

      {EMBERS.map((cls) => (
        <span
          key={cls}
          aria-hidden
          className={cn("absolute animate-rise rounded-full bg-ember", cls)}
        />
      ))}
    </div>
  )
}

export function Hero() {
  const product = FLAME_SKULL_MOUNT

  return (
    <section className="grain relative overflow-hidden bg-void lg:h-[760px]">
      {/* Desktop: the plate owns the right half; the scrim keeps type off it. */}
      <div className="absolute inset-y-0 right-0 hidden w-[58%] lg:block">
        <SkullStage className="size-full" priority />
      </div>
      <div
        aria-hidden
        className="absolute inset-0 hidden bg-[linear-gradient(90deg,var(--color-void)_0%,var(--color-void)_40%,rgb(7_6_10_/_0.82)_50%,rgb(7_6_10_/_0)_66%)] lg:block"
      />

      <div className="relative z-10 flex flex-col justify-center px-5 pt-12 pb-14 sm:px-8 lg:h-full lg:w-[620px] lg:px-0 lg:py-0 lg:pl-14">
        <div className="mb-6 flex items-center gap-2.5 font-mono text-[11px] tracking-[0.22em] text-acid uppercase sm:text-[11.5px]">
          <span className="size-[7px] animate-blink rounded-full bg-acid" />
          3D-printed in India · Batch {product.batch} live
        </div>

        <h1 className="mb-7 font-display text-[58px] leading-[1.0] text-bone uppercase sm:text-[78px] lg:mb-8 lg:text-[108px]">
          Park
          <br />
          the <span className="text-blaze">menace</span>
        </h1>

        {/* Phone/tablet: the plate sits between the headline and the copy.
            Hidden at lg, which is why the h1 carries its own bottom margin. */}
        <SkullStage className="mb-6 aspect-square w-full lg:hidden" priority />

        <p className="mb-8 max-w-[440px] text-[15.5px] leading-[1.62] text-ash text-pretty sm:text-[17.5px]">
          Your lid has been living on the floor, the bed, the bike seat. Bolt a flaming skull to the
          wall and give it a throne, plus a hook underneath for the gloves.
        </p>

        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <ButtonLink href={`/product/${product.slug}`} variant="primary" size="lg">
            Grab yours · {formatMoney(product.price)}
            <ArrowRight className="size-[17px]" strokeWidth={2.4} />
          </ButtonLink>
          <ButtonLink href="#reel" variant="ghost" size="lg">
            <Play className="size-[15px] fill-current" strokeWidth={0} />
            Watch the build
          </ButtonLink>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[11px] tracking-[0.13em] text-dim sm:text-[11.5px]">
          <span className="text-bone">
            <Stars rating={product.rating} className="mr-1.5" />
            {product.rating} · {product.reviewCount} riders
          </span>
          <span aria-hidden className="hidden h-3 w-px bg-white/15 sm:block" />
          <span>FREE SHIPPING</span>
          <span aria-hidden className="hidden h-3 w-px bg-white/15 sm:block" />
          <span>7-DAY RETURNS</span>
        </div>

        {/* Phone/tablet chips: a grid under the copy, never over the artwork. */}
        <div className="mt-8 grid grid-cols-2 gap-2.5 lg:hidden">
          {CHIPS.map((chip) => (
            <div
              key={chip.label}
              className="flex items-center gap-2.5 rounded-lg border border-white/[0.12] bg-carbon/80 px-3.5 py-2.5"
            >
              <span className={cn("size-1.5 shrink-0 rounded-full", chip.dot)} />
              <span className="font-mono text-[9.5px] tracking-[0.1em] text-bone">{chip.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Desktop chips: a rail at the far edge, clear of the skull. */}
      <div className="absolute top-1/2 right-10 z-20 hidden w-[216px] -translate-y-1/2 flex-col gap-2.5 lg:flex">
        {CHIPS.map((chip) => (
          <div
            key={chip.label}
            className="flex items-center gap-2.5 rounded-lg border border-white/[0.12] bg-carbon/80 px-3.5 py-3 backdrop-blur-md"
          >
            <span className={cn("size-1.5 shrink-0 rounded-full", chip.dot)} />
            <span className="font-mono text-[10px] tracking-[0.12em] text-bone">{chip.label}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
