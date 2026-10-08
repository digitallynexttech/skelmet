"use client"

import * as React from "react"

import LOCKUP from "@/components/shared/lockup-mono.json"
import { siteConfig } from "@/config/site"
import { cn } from "@/lib/utils"

/**
 * Two brand-orange halves that part once the page is ready; the wordmark fill is the progress bar.
 * Server-rendered so no frame of the page shows first. Fill and count are CSS animations of
 * transform only (globals.css), so they run off the main thread during hydration; keep it that way.
 * The CSS fill holds short of the end and this file finishes it before opening. Reduced motion and
 * a CSS failsafe (globals.css) hide it without JavaScript.
 */

// Both holds count from navigation start, not hydration.
const MIN_HOLD_MS = 1100 // so a warm cache does not flash it
const MAX_HOLD_MS = 2000 // a stalled font must never trap the visitor

/** Content fade (400ms) then the halves parting (1200ms, starting at 150ms). */
const EXIT_MS = 950

/** Finishing the fill: `whole` for the full wordmark, pro rata, clamped to least..most. */
const FINISH_MS = { whole: 2200, least: 180, most: 460, hurried: 160 }

const FIGURES = Array.from({ length: 101 }, (_, n) => n)

// Set when the splash finishes, never on mount (StrictMode's remount would eat the run). Covers a
// round trip to /admin remounting this layout. Client-only: on the server it is shared by requests.
let splashCompleted = false

// The bail-out must land before paint or an orange frame flashes; layout effects warn in SSR.
const useBeforePaint = typeof window === "undefined" ? React.useEffect : React.useLayoutEffect

const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

type Phase = "intro" | "exit" | "done"

export function SplashScreen() {
  const [phase, setPhase] = React.useState<Phase>("intro")

  const fillRef = React.useRef<HTMLDivElement>(null)
  const figuresRef = React.useRef<HTMLSpanElement>(null)

  // Reduced motion skips it outright: a still frame would be a flat orange rectangle.
  useBeforePaint(() => {
    if (splashCompleted || prefersReducedMotion()) setPhase("done")
  }, [])

  React.useEffect(() => {
    if (phase !== "intro") return

    const abort = new AbortController()
    let cancelled = false

    // Ready = document loaded and fonts resolved (the count is set in Anton). A rejection counts.
    const loaded = Promise.all([
      document.readyState === "complete"
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            window.addEventListener("load", () => resolve(), { once: true, signal: abort.signal })
          }),
      document.fonts ? document.fonts.ready : Promise.resolve(),
    ]).catch(() => {})

    let hurried = false
    const hurry = new Promise<void>((resolve) => {
      const skip = () => {
        hurried = true
        resolve()
      }
      window.addEventListener("pointerdown", skip, { signal: abort.signal })
      window.addEventListener("keydown", skip, { signal: abort.signal })
    })

    // Runs fill and count out from wherever the CSS has got them, read off the fill's transform.
    const finish = async () => {
      const fill = fillRef.current
      const inner = fill?.firstElementChild
      const figures = figuresRef.current
      if (!fill || !inner || !figures || typeof fill.animate !== "function") return
      const x = new DOMMatrixReadOnly(getComputedStyle(fill).transform).m41
      const hidden = Math.min(1, Math.max(0, -x / (fill.offsetWidth || 1)))
      if (hidden < 0.002) return
      const timing = {
        duration: hurried
          ? FINISH_MS.hurried
          : Math.min(FINISH_MS.most, Math.max(FINISH_MS.least, hidden * FINISH_MS.whole)),
        easing: "cubic-bezier(0.33, 1, 0.68, 1)",
        fill: "forwards" as const,
      }
      const to = { transform: "translateX(0)" }
      const done = fill.animate([{ transform: `translateX(${-hidden * 100}%)` }, to], timing)
      inner.animate([{ transform: `translateX(${hidden * 100}%)` }, to], timing)
      // 100 rows up is the last of the 101.
      const row = 100 / FIGURES.length
      figures.animate(
        [
          { transform: `translateY(${-(1 - hidden) * 100 * row}%)` },
          { transform: `translateY(${-100 * row}%)` },
        ],
        timing,
      )
      await done.finished.catch(() => {})
    }

    // performance.now() counts from navigation start, not from this effect.
    const ceiling = wait(Math.max(0, MAX_HOLD_MS - performance.now()))
    void Promise.race([loaded, ceiling, hurry]).then(async () => {
      if (cancelled) return
      await finish()
      if (!hurried) await Promise.race([hurry, wait(Math.max(0, MIN_HOLD_MS - performance.now()))])
      if (!cancelled) setPhase("exit")
    })

    return () => {
      cancelled = true
      abort.abort()
    }
  }, [phase])

  React.useEffect(() => {
    if (phase !== "exit") return
    const timer = setTimeout(() => {
      splashCompleted = true
      setPhase("done")
    }, EXIT_MS)
    return () => clearTimeout(timer)
  }, [phase])

  // Scroll lock while it is up.
  React.useEffect(() => {
    if (phase === "done") return
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previous
    }
  }, [phase])

  if (phase === "done") return null

  const exiting = phase === "exit"
  const viewBox = `0 0 ${LOCKUP.width} ${LOCKUP.height}`

  return (
    <div
      data-splash=""
      // Decorative over the mounted page; keep nothing in it focusable.
      aria-hidden="true"
      className={cn("fixed inset-0 z-100 overflow-hidden", exiting && "pointer-events-none")}
    >
      {/* Without JS it could never be dismissed, so never show it. */}
      <noscript>
        <style dangerouslySetInnerHTML={{ __html: "[data-splash]{display:none!important}" }} />
      </noscript>

      {(["top", "bottom"] as const).map((half) => (
        <div
          key={half}
          className={cn(
            "grain bg-blaze absolute inset-x-0 h-1/2",
            "transition-transform delay-150 duration-[1200ms] ease-[cubic-bezier(0.76,0,0.24,1)]",
            half === "top" ? "top-0" : "bottom-0",
            exiting && (half === "top" ? "-translate-y-full" : "translate-y-full"),
          )}
        />
      ))}

      {/* Fades before the halves move, so the parting reveals the page. */}
      <div
        className={cn(
          "absolute inset-0 z-10 flex flex-col items-center justify-center px-6",
          "transition-[opacity,scale] duration-400 ease-[cubic-bezier(0.16,1,0.3,1)]",
          exiting && "scale-90 opacity-0",
        )}
      >
        {/* The reveal is a window sliding right with the wordmark inside sliding left: two
            transforms, where a clip-path or width would repaint on the main thread. */}
        <div
          className="text-bone relative w-[min(560px,82vw)]"
          style={{ aspectRatio: `${LOCKUP.width} / ${LOCKUP.height}` }}
        >
          <svg viewBox={viewBox} className="block size-full opacity-30">
            <path id="splash-lockup" fill="currentColor" fillRule="evenodd" d={LOCKUP.d} />
          </svg>
          <div ref={fillRef} data-splash-fill="" className="absolute inset-0 overflow-hidden">
            <div className="size-full">
              <svg viewBox={viewBox} className="block size-full">
                <use href="#splash-lockup" />
              </svg>
            </div>
          </div>
        </div>

        {/* The count is a column of 0..100 rolled past a one-row window (globals.css), a
            transform, so it counts before this file loads. */}
        <div className="mt-4 flex w-[min(560px,82vw)] items-end justify-between gap-6">
          <span className="text-void/70 font-mono text-[10px] tracking-[0.2em] uppercase sm:text-[12px]">
            {siteConfig.tagline}
          </span>
          <span className="text-void font-display flex text-[clamp(1.2rem,3vw,2rem)] leading-none tabular-nums">
            <span className="block h-[1em] overflow-hidden">
              <span ref={figuresRef} data-splash-count="" className="flex flex-col items-end">
                {FIGURES.map((n) => (
                  <span key={n} className="block h-[1em]">
                    {n}
                  </span>
                ))}
              </span>
            </span>
            %
          </span>
        </div>
      </div>
    </div>
  )
}
