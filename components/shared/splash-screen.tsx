"use client"

import * as React from "react"

import LOCKUP from "@/components/shared/lockup-mono.json"
import { siteConfig } from "@/config/site"
import { cn } from "@/lib/utils"

/**
 * The curtain: two brand-orange halves that part once the page is ready.
 *
 * Built to the Digitally Next preloader - a solid field of the brand colour
 * split down the middle, the wordmark filling left to right as the page loads,
 * and the count sitting opposite the tagline on one baseline. The wordmark is
 * the progress bar; there is no second one.
 *
 * Server-rendered on purpose. A splash mounted only after hydration would let a
 * frame of the real page through first, which is the exact flash it exists to
 * hide - so the markup ships in the HTML and the client's only job is to take
 * it away again.
 *
 * Nothing on it waits for this file, or for anything else. The wordmark is
 * drawn inline (it was an image, and on a slow connection the curtain opened
 * before it had arrived), and the fill and the count are CSS animations
 * (globals.css) that start with the first paint. Both are transforms and
 * nothing else, which the browser runs off the main thread: the splash is up
 * during the busiest second of the page's life - hydration, and the 3D skull
 * starting behind it - and a fill stepped from requestAnimationFrame
 * stuttered through every long task, sat at 0% until the script arrived, or
 * was cut off half way. That is also why the count is a column of figures
 * rolling past a window rather than a number being rewritten.
 *
 * On its own the fill runs most of the way, holds, and then completes: the
 * last stretch belongs to the real load. When the page is in, this file
 * finishes the fill from wherever it has got to and only then opens the
 * curtain, so it always opens on a full wordmark at 100%.
 *
 * Shown on every full page load - a first visit, a reload, a new tab - and
 * never on a move within the site. It lives in a layout, so client navigation
 * does not replay it, and `splashCompleted` covers bouncing out to /admin and
 * back, which remounts this layout. It used to play once per browser session,
 * remembered in sessionStorage, and a reload skipping it read as broken.
 * Reduced motion hides it in CSS (globals.css), so that case never waits for
 * JavaScript to take an orange screen away.
 *
 * Dismissal is bounded at both ends, measured from navigation start rather
 * than from hydration: on a slow phone the JavaScript alone can take seconds,
 * and the curtain must not add its whole hold on top of that. MIN_HOLD stops a
 * warm cache flashing it for two frames; MAX_HOLD opens it however the load is
 * going. A click, tap or keypress hurries the rest, and a CSS-only failsafe
 * (globals.css) lifts it even if the JavaScript never arrives.
 *
 * Nothing holds it down. The hero's 3D model takes over from its poster
 * behind the curtain on a visit where the browser already holds the file, and
 * later otherwise (see SkullStage); either way the curtain does not wait.
 */

/** Brand beat floor, from navigation start, so a warm cache does not flash it and vanish. */
const MIN_HOLD_MS = 1100
/** Hard ceiling, from navigation start. A stalled font must never trap the visitor. */
const MAX_HOLD_MS = 2000

/** Content fade (400ms) then the halves parting (1200ms, starting at 150ms). */
const EXIT_MS = 950

/**
 * Finishing the fill once the page is in: this long for the whole wordmark,
 * in proportion for what is left of it, and never so short it snaps.
 */
const FINISH_MS = { whole: 2200, least: 180, most: 460, hurried: 160 }

/** The count's figures, 0 to 100, one to a row. */
const FIGURES = Array.from({ length: 101 }, (_, n) => n)

/**
 * Set only once the splash has actually finished, never on mount: StrictMode's
 * remount in development would otherwise eat the first run and leave the
 * developer looking at a splash they can never see.
 *
 * Read and written from client-only code paths exclusively. On the server a
 * module binding is shared by every request, so consulting it during render
 * would let one visitor's splash suppress the next visitor's.
 */
let splashCompleted = false

/**
 * A layout effect on the client, a plain effect on the server. The bail-out
 * checks have to land before paint or the page flashes an orange frame, and
 * React warns if a layout effect runs during SSR.
 */
const useBeforePaint = typeof window === "undefined" ? React.useEffect : React.useLayoutEffect

const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

type Phase = "intro" | "exit" | "done"

export function SplashScreen() {
  const [phase, setPhase] = React.useState<Phase>("intro")

  const fillRef = React.useRef<HTMLDivElement>(null)
  const figuresRef = React.useRef<HTMLSpanElement>(null)

  // The ways to never play at all. CSS has already hidden the markup for
  // reduced motion; this takes it out of the tree and releases the scroll lock.
  //
  // Reduced motion skips the intro outright rather than holding a still frame
  // of it: every element here arrives on a delayed animation, so a motionless
  // version is a flat orange rectangle over a page that is already there. The
  // /admin round trip remounting this layout has seen it already.
  useBeforePaint(() => {
    if (splashCompleted || prefersReducedMotion()) setPhase("done")
  }, [])

  // The intro's one decision: when the page is in, run the fill out and open.
  React.useEffect(() => {
    if (phase !== "intro") return

    const abort = new AbortController()
    let cancelled = false

    // What "ready" means here: the document has finished loading and the
    // display face is resolved. Anton arriving late is the one swap the visitor
    // would notice, since the count is set in it. A rejected font promise is
    // still an answer: show the page either way.
    const loaded = Promise.all([
      document.readyState === "complete"
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            window.addEventListener("load", () => resolve(), { once: true, signal: abort.signal })
          }),
      document.fonts ? document.fonts.ready : Promise.resolve(),
    ]).catch(() => {})

    // Anything the visitor does to get past it counts.
    let hurried = false
    const hurry = new Promise<void>((resolve) => {
      const skip = () => {
        hurried = true
        resolve()
      }
      window.addEventListener("pointerdown", skip, { signal: abort.signal })
      window.addEventListener("keydown", skip, { signal: abort.signal })
    })

    /**
     * Run the fill and the count out to the end from wherever the CSS has got
     * them. Read off the fill's own transform, so the two never disagree.
     */
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
      // A hundred rows up is the last of the hundred and one.
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

  // Unmount once the halves have finished travelling.
  React.useEffect(() => {
    if (phase !== "exit") return
    const timer = setTimeout(() => {
      splashCompleted = true
      setPhase("done")
    }, EXIT_MS)
    return () => clearTimeout(timer)
  }, [phase])

  // Nothing behind the curtain should move while it is down.
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
      // Purely decorative, and the real page is already mounted underneath, so
      // assistive tech is better served reading straight through it. Nothing
      // in here is focusable, which keeps that honest - the first Tab lands on
      // the page and dismisses the splash on the way.
      aria-hidden="true"
      className={cn(
        "fixed inset-0 z-100 overflow-hidden",
        // Hand clicks back to the page the moment the halves start moving.
        exiting && "pointer-events-none",
      )}
    >
      {/* Without JS the splash can never be dismissed, so it must never be
          shown. The page underneath renders perfectly well on its own. */}
      <noscript>
        <style dangerouslySetInnerHTML={{ __html: "[data-splash]{display:none!important}" }} />
      </noscript>

      {/* The curtain, in two halves. A solid field of the brand colour rather
          than the page's own black: the point is that something is covering the
          site, and void on void would read as a slow page instead. */}
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

      {/* Sits on the seam, and leaves before the halves move so the parting
          reveals the page rather than dragging the intro off with it. */}
      <div
        className={cn(
          "absolute inset-0 z-10 flex flex-col items-center justify-center px-6",
          "transition-[opacity,scale] duration-400 ease-[cubic-bezier(0.16,1,0.3,1)]",
          exiting && "scale-90 opacity-0",
        )}
      >
        {/* The wordmark is the progress bar. A dimmed copy underneath, the solid
            one revealed over it from the left, so the brand fills in as the page
            loads - the reference's outline-and-fill mechanic, with the real
            lockup standing in for its outlined type.

            The reveal is a window sliding in from the left with the wordmark
            inside it sliding the other way, so the wordmark stands still and
            only its visible part grows: two transforms, where a clip-path or a
            width would be redrawn on the main thread every frame. */}
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

        {/* Tagline and count sit at opposite ends of the wordmark's width. The
            count is every figure from 0 to 100 in a column, rolled up past a
            window one row tall (globals.css), so it counts before this file
            has loaded and keeps counting while the page hydrates. */}
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
