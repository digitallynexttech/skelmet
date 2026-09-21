import { ArrowRight } from "lucide-react"

import { SkullStage } from "@/components/marketing/skull-stage"
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

/**
 * Centred hero. The canvas is transparent, so the skull's silhouette — not its
 * bounding box — is what occludes the type. That is the whole effect: the
 * object stands in front of the words rather than on top of a rectangle.
 *
 * Two layouts, switched at `xl`:
 *
 * - Below xl the pitch and the CTA sit under the artwork in normal flow, so
 *   they eat into the height budget and the stage has to give way.
 * - At xl they are lifted out of flow to flank the model, which hands the
 *   entire remaining height back to the artwork. That needs roughly 350px of
 *   clear space either side of the *visible* skull, which only exists from
 *   1280px up — hence xl rather than lg.
 *
 * `--stage` is the canvas height and drives the headline with it, so their
 * ratio survives any resize. `--hw` caps the headline against viewport width,
 * which is the binding constraint on phones and never on desktop.
 *
 * Stays a Server Component. Only `SkullStage` is a client leaf, and the
 * three.js chunk is dynamically imported inside it.
 */
export function Hero() {
  const product = FLAME_SKULL_MOUNT

  return (
    <section className="grain relative overflow-hidden bg-void lg:flex lg:min-h-[calc(100svh-74px)] lg:flex-col">
      {/* Warm bloom behind the whole composition. */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-[-8%] left-1/2 h-[620px] w-[1100px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse,rgb(255_90_31_/_0.16),transparent_62%)] blur-[60px]"
      />

      <div className="relative z-10 mx-auto flex w-full max-w-[1400px] flex-col items-center px-5 pt-12 pb-12 text-center sm:px-8 lg:grow lg:justify-center lg:py-4 xl:py-2">
        <div
          className={cn(
            "relative flex w-full flex-col items-center",
            "[--hw:14.4vw] [--stage:512px] sm:[--stage:600px]",
            "lg:[--hw:14vw] lg:[--stage:min(660px,calc(100svh_-_397px))]",
            "xl:[--hw:18.8vw] xl:[--stage:min(720px,calc(100svh_-_180px))]",
            // Tail: the flanks anchor to this wrapper, which otherwise stops at
            // the chin and strands them mid-section. It reaches into the slack
            // the section min-height leaves below, so bottom-0 lands where the
            // hero actually ends.
            "xl:[--tail:70px] xl:pb-[var(--tail)]",
          )}
        >
          {/* The headline is measured against the canvas, not the outer
              wrapper — below xl the wrapper also holds the stacked pitch and
              CTA, and a percentage of that taller box dropped the line onto the
              skull's widest point. */}
          <div
            className={cn(
              "relative aspect-[4/5] w-full max-w-[410px] sm:max-w-[480px]",
              "lg:h-[var(--stage)] lg:w-auto lg:max-w-none",
            )}
          >
            {/* Deliberately unadorned: no shadow, outline or glow. All the
                weight comes from scale, the condensed cut and tight tracking,
                and from the skull cutting across the middle of the line.

                Sized to run out to the viewport edges, which a display face at
                its natural width cannot do without growing taller than the
                space under the header — so at xl the cap height is bought back
                with `scale-x`. The cranium is a solid mass several glyphs
                wide, so a line this size and a skull this size cannot be
                disjoint; it swallows the middle word, which is the effect. */}
            <h1
              className={cn(
                "pointer-events-none absolute top-[8%] left-1/2 z-10 w-max",
                "-translate-x-1/2 -translate-y-1/2 lg:top-[23%] xl:top-[20.3%]",
                "font-display text-[max(36px,min(var(--hw),calc(var(--stage)*0.29)))]",
                "lg:text-[max(36px,min(var(--hw),calc(var(--stage)*0.4)))]",
                // Squeezed only at xl, where the line is wide enough that its
                // natural cap height would collide with the header. Narrower
                // viewports reach the edges before that happens, so condensing
                // there would only cost width and buy height with nowhere to go.
                "xl:text-[max(36px,min(var(--hw),calc(var(--stage)*0.42)))] xl:[scale:0.84_1]",
                "leading-[0.9] tracking-[-0.035em] whitespace-nowrap text-center text-bone uppercase",
              )}
            >
              Park the{" "}
              <span className="text-blaze">menace</span>
            </h1>

            <SkullStage className="z-20 size-full" />
          </div>

          {/* Sits in the canvas's transparent margin below the chin at xl, so
              the affordance costs nothing from the height budget. */}
          <span className="mt-1 flex items-center gap-3 font-mono text-[10px] tracking-[0.2em] text-dim uppercase xl:absolute xl:bottom-[var(--tail)] xl:left-1/2 xl:mt-0 xl:-translate-x-1/2">
            <span aria-hidden className="hidden h-px w-7 bg-current opacity-50 sm:block" />
            Drag to spin
            <span aria-hidden className="hidden h-px w-7 bg-current opacity-50 sm:block" />
          </span>

          {/* Pitch: bottom left of the model. The flanks are anchored to the
              container edges and clear the *visible* skull, not the canvas —
              the canvas is mostly transparent, so overlapping it is free. They
              outrank it on z so the buttons stay clickable. */}
          <div className="mt-6 flex flex-col items-center xl:absolute xl:bottom-0 xl:left-0 xl:z-30 xl:mt-0 xl:items-start">
            <p className="max-w-[540px] text-[15.5px] leading-[1.62] text-ash text-pretty sm:text-[17.5px] xl:max-w-[430px] xl:text-left">
              Your helmet has earned every scratch on it, then spends the week on the floor. Bolt a
              flaming skull to the wall, hook the gloves under its jaw, and give your gear the same
              thought you gave the bike.
            </p>

            <span aria-hidden className="mt-6 hidden h-px w-14 bg-blaze xl:block" />
            <span className="mt-4 hidden font-mono text-[11px] tracking-[0.22em] text-dim uppercase xl:block">
              Gear that rides with you
            </span>
          </div>

          {/* Buy + spec chips: bottom right of the model. */}
          <div className="mt-7 flex w-full flex-col items-center gap-4 sm:w-auto xl:absolute xl:right-0 xl:bottom-0 xl:z-30 xl:mt-0 xl:items-end">
            <ButtonLink
              href={`/product/${product.slug}`}
              variant="primary"
              size="lg"
              className="w-full sm:w-auto"
            >
              Add to cart · {formatMoney(product.price)}
              <ArrowRight className="size-[17px]" strokeWidth={2.4} />
            </ButtonLink>

            <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4 xl:grid-cols-2">
              {CHIPS.map((chip) => (
                <div
                  key={chip.label}
                  className="flex items-center gap-2.5 rounded-lg border border-white/[0.12] bg-carbon/80 px-3.5 py-2.5 backdrop-blur-md"
                >
                  <span className={cn("size-1.5 shrink-0 rounded-full", chip.dot)} />
                  <span className="font-mono text-[9.5px] tracking-[0.1em] text-bone sm:text-[10px]">
                    {chip.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
