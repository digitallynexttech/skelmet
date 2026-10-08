import { MoveLeft, MoveRight } from "lucide-react"

import { HeroHeadline } from "@/components/marketing/hero-headline"
import { SkullStage } from "@/components/marketing/skull-stage"
import { ButtonLink } from "@/components/ui/button"
import { FLAME_SKULL_MOUNT } from "@/features/catalog/catalog"
import { cn } from "@/lib/utils"

/**
 * The canvas is transparent, so the skull's silhouette occludes the type. At xl the pitch
 * and CTA flank the model out of flow, which needs ~350px clear each side (1280px up).
 * `--stage` is the canvas height and sizes the headline; `--hw` caps it on narrow screens.
 */
export function Hero() {
  const product = FLAME_SKULL_MOUNT

  return (
    <section className="grain bg-void relative overflow-hidden lg:flex lg:min-h-[calc(100svh-74px-36px)] lg:flex-col">
      <div
        aria-hidden
        className="pointer-events-none absolute top-[-8%] left-1/2 h-[620px] w-[1100px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse,rgb(255_90_31_/_0.16),transparent_62%)] blur-[60px]"
      />

      <div className="relative z-10 mx-auto flex w-full max-w-[1400px] flex-col items-center px-5 pt-3 pb-12 text-center sm:px-8 sm:pt-10 lg:grow lg:justify-center lg:py-4 xl:max-w-[1600px] xl:px-14 xl:py-2">
        <div
          className={cn(
            "relative flex w-full flex-col items-center",
            "[--hw:14.4vw] [--stage:512px] sm:[--stage:600px]",
            "lg:[--hw:14vw] lg:[--stage:min(660px,calc(100svh_-_451px))]",
            "xl:[--hw:18.8vw] xl:[--stage:min(720px,calc(100svh_-_216px))]",
            // Tail: extends this wrapper to the hero's end, where the xl flanks anchor.
            "xl:pb-[var(--tail)] xl:[--tail:70px]",
          )}
        >
          {/* The headline must stay inside the canvas box: it is positioned and measured
              against it. */}
          <div
            className={cn(
              "relative aspect-[4/5] w-full max-w-[410px] sm:max-w-[480px]",
              // Phones: shrinks so everything down to the CTA fits the first screen.
              // 380px is the header, strip and what stacks below; 0.8 is the 4:5 ratio.
              "max-sm:max-w-[max(240px,min(410px,calc((100svh-380px)*0.8)))]",
              "lg:h-[var(--stage)] lg:w-auto lg:max-w-none",
            )}
          >
            {/* The skull covering the middle word is intended. */}
            <HeroHeadline
              className={cn(
                "pointer-events-none absolute top-[8%] left-1/2 z-10 w-max",
                "-translate-x-1/2 -translate-y-1/2 lg:top-[23%] xl:top-[20.3%]",
                "font-display text-[max(36px,min(var(--hw),calc(var(--stage)*0.29)))]",
                "lg:text-[max(36px,min(var(--hw),calc(var(--stage)*0.4)))]",
                // Condensed only at xl, where the natural cap height would hit the header.
                // Y gets a lighter squeeze, keeping the caps near Anton's own proportions.
                "xl:[scale:0.84_0.88] xl:text-[max(36px,min(var(--hw),calc(var(--stage)*0.42)))]",
                "text-bone text-center leading-[0.9] tracking-[-0.035em] whitespace-nowrap uppercase",
              )}
            >
              Park the <span className="text-blaze">menace</span>
            </HeroHeadline>

            <SkullStage className="z-20 size-full" />
          </div>

          {/* Shown only once the 3D model is live (skull-stage marks <html>). Its space is
              kept either way, so nothing moves when it appears. */}
          <span
            aria-hidden
            className={cn(
              "opacity-0 transition-opacity duration-500 [html[data-skull-live]_&]:opacity-100",
              // Keep the vertical padding: at xl the bottom edge is pinned, and without it
              // the label slides onto the chin.
              "mt-2 flex items-center gap-3 py-2",
              "text-bone font-mono text-[11px] tracking-[0.14em] uppercase",
              // Below the canvas edge (the chin reaches it), and above the canvas on z.
              "xl:absolute xl:bottom-[calc(var(--tail)_-_24px)] xl:left-1/2 xl:z-30 xl:mt-0 xl:-translate-x-1/2",
            )}
          >
            <MoveLeft aria-hidden className="text-blaze size-5 shrink-0" strokeWidth={2} />
            Drag to spin
            <MoveRight aria-hidden className="text-blaze size-5 shrink-0" strokeWidth={2} />
          </span>

          {/* The xl flanks may overlap the transparent canvas but must clear the visible
              skull, and sit above it on z so the buttons stay clickable. */}
          <div className="mt-4 flex flex-col items-center sm:mt-6 xl:absolute xl:bottom-0 xl:left-0 xl:z-30 xl:mt-0 xl:items-start">
            <p className="text-ash max-w-[540px] text-[15.5px] leading-[1.62] text-pretty sm:text-[17.5px] xl:max-w-[min(480px,33vw)] xl:text-left">
              Give your helmet the same love as your bike. Mount it in style, flaunt the gear, and
              make your helmet look as thrilling as your rides.
            </p>

            <span aria-hidden className="bg-blaze mt-6 hidden h-px w-14 xl:block" />
            <span className="text-dim mt-4 hidden font-mono text-[11px] tracking-[0.22em] uppercase xl:block">
              Gear that rides with you
            </span>
          </div>

          <div className="mt-5 flex w-full flex-col items-center sm:mt-7 sm:w-auto xl:absolute xl:right-0 xl:bottom-0 xl:z-30 xl:mt-0 xl:items-end">
            <ButtonLink
              href={`/product/${product.slug}`}
              variant="primary"
              size="lg"
              className="w-full sm:w-auto"
            >
              Grab yours
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  )
}
