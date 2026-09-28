"use client"

import * as React from "react"
import Image from "next/image"

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
 * Shown once per browser session. It lives in a layout, so moving around the
 * site never replays it; and once it has played, sessionStorage remembers, and
 * the inline script in app/layout.tsx marks <html data-splash-skip> before the
 * first paint of every later page load in the session, which hides it in CSS.
 * Reduced motion hides it in CSS too (globals.css), so neither case waits for
 * JavaScript to take an orange screen away. `splashCompleted` still covers
 * bouncing out to /admin and back, which remounts this layout.
 *
 * Dismissal is bounded at both ends, measured from navigation start rather
 * than from hydration: on a slow phone the JavaScript alone can take seconds,
 * and the curtain must not add its whole hold on top of that. MIN_HOLD stops a
 * warm cache flashing it for two frames; MAX_HOLD opens it however the load is
 * going. A click, tap or keypress skips the rest, and a CSS-only failsafe
 * (globals.css) lifts it even if the JavaScript never arrives.
 *
 * Nothing holds it down any more. The hero's 3D model used to, so the swap
 * from poster to model happened behind the curtain - but that made every
 * visitor wait for a megabyte they may never see. The poster is a finished
 * hero; the model fades in over it later.
 */

/** Brand beat floor, from navigation start, so a warm cache does not flash it and vanish. */
const MIN_HOLD_MS = 1100
/** Hard ceiling, from navigation start. A stalled font must never trap the visitor. */
const MAX_HOLD_MS = 2000

/** The session's memory that the intro has played. The same key is read in app/layout.tsx. */
const SPLASH_SEEN_KEY = "skm.splash"
/** Content fade (400ms) then the halves parting (1200ms, starting at 150ms). */
const EXIT_MS = 950

/**
 * How far the fill creeps while the page is still loading. It never reaches the
 * end on its own: the last stretch belongs to the real load event, so the
 * number stays a genuine signal rather than a timed fiction.
 */
const CREEP_CEILING = 0.92
/** Per-frame approach rate toward the target. Faster once the page is in. */
const CREEP_RATE = 0.03
const SETTLE_RATE = 0.14

/**
 * The single-colour lockup, not the two-tone one: that version's skull is blaze
 * orange and would disappear into the panel behind it.
 */
const LOCKUP = { src: "/brand/skelmet-lockup-mono.png", width: 997, height: 347 }

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

type Phase = "intro" | "exit" | "done"

export function SplashScreen() {
  const [phase, setPhase] = React.useState<Phase>("intro")

  const fillRef = React.useRef<HTMLDivElement>(null)
  const readoutRef = React.useRef<HTMLSpanElement>(null)

  // The ways to never play at all. CSS has already hidden the markup for the
  // first two; this takes it out of the tree and releases the scroll lock.
  //
  // Reduced motion skips the intro outright rather than holding a still frame
  // of it: every element here arrives on a delayed animation, so a motionless
  // version is a flat orange rectangle over a page that is already there. A
  // later page load in the same session has seen it, and so has the /admin
  // round trip remounting this layout.
  useBeforePaint(() => {
    if (
      splashCompleted ||
      prefersReducedMotion() ||
      document.documentElement.hasAttribute("data-splash-skip")
    ) {
      setPhase("done")
    }
  }, [])

  // The whole intro: loading signals, the fill ramp, and the two clocks that
  // decide when the curtain opens. One effect, because they are one sequence -
  // splitting them would mean sharing `loaded` through a ref for no gain.
  React.useEffect(() => {
    if (phase !== "intro") return

    const abort = new AbortController()

    // What "ready" means here: the document has finished loading and the
    // display face is resolved. Anton arriving late is the one swap the visitor
    // would notice, since the count is set in it.
    const signals: Promise<unknown>[] = [
      document.readyState === "complete"
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            window.addEventListener("load", () => resolve(), {
              once: true,
              signal: abort.signal,
            })
          }),
    ]
    if (document.fonts) signals.push(document.fonts.ready)

    let loaded = false
    const markLoaded = () => {
      loaded = true
    }
    // A rejected font promise is still an answer: show the page either way.
    void Promise.all(signals).then(markLoaded, markLoaded)

    // Driven straight into the DOM rather than through state. This runs during
    // the busiest part of the page load - hydration and the three.js chunk are
    // competing for the same main thread - and a clip write costs no React
    // render and no layout.
    let value = 0
    let frame = 0

    const tick = (now: number) => {
      // rAF's timestamp counts from navigation start, not from this effect.
      const elapsed = now
      // The ceiling is a backstop for a load event that never fires, and it is
      // treated exactly like a real one so the fill still runs out instead of
      // snapping.
      const settled = loaded || elapsed >= MAX_HOLD_MS

      const target = settled ? 1 : CREEP_CEILING
      value += (target - value) * (settled ? SETTLE_RATE : CREEP_RATE)
      // Asymptotes never arrive; close enough is the end.
      if (target - value < 0.004) value = target

      if (fillRef.current) {
        fillRef.current.style.clipPath = `inset(0 ${((1 - value) * 100).toFixed(2)}% 0 0)`
      }
      const percent = `${Math.round(value * 100)}%`
      if (readoutRef.current && readoutRef.current.textContent !== percent) {
        readoutRef.current.textContent = percent
      }

      // Being full already implies settled - the target is only ever 1 then.
      if (value >= 1 && elapsed >= MIN_HOLD_MS) {
        setPhase("exit")
        return
      }
      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => {
      abort.abort()
      cancelAnimationFrame(frame)
    }
  }, [phase])

  // Skip. Anything the visitor does to get past it counts.
  React.useEffect(() => {
    if (phase !== "intro") return
    const abort = new AbortController()
    const skip = () => setPhase("exit")
    window.addEventListener("pointerdown", skip, { signal: abort.signal })
    window.addEventListener("keydown", skip, { signal: abort.signal })
    return () => abort.abort()
  }, [phase])

  // Unmount once the halves have finished travelling.
  React.useEffect(() => {
    if (phase !== "exit") return
    const timer = setTimeout(() => {
      splashCompleted = true
      try {
        sessionStorage.setItem(SPLASH_SEEN_KEY, "1")
      } catch {
        // Storage refused (private mode, blocked site data): it plays again on
        // the next reload, which is harmless.
      }
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
            one clipped over it from the left, so the brand fills in as the page
            actually loads - the reference's outline-and-fill mechanic, with the
            real lockup standing in for its outlined type. */}
        <div className="relative w-[min(560px,82vw)]">
          {/* Lazy, so on a page load where the splash is skipped (display:
              none) it is never fetched at all. High priority once it is: while
              the splash is up it is the largest thing on screen, and at low
              priority it queued behind every script and held LCP to 2.5 s on
              a phone. */}
          <Image
            src={LOCKUP.src}
            width={LOCKUP.width}
            height={LOCKUP.height}
            alt=""
            loading="lazy"
            fetchPriority="high"
            sizes="(min-width: 640px) 560px, 82vw"
            className="h-auto w-full opacity-30"
          />
          <div ref={fillRef} className="absolute inset-0 [clip-path:inset(0_100%_0_0)]">
            <Image
              src={LOCKUP.src}
              width={LOCKUP.width}
              height={LOCKUP.height}
              alt=""
              loading="lazy"
              fetchPriority="high"
              sizes="(min-width: 640px) 560px, 82vw"
              className="h-auto w-full"
            />
          </div>
        </div>

        {/* Tagline and count share one baseline across the wordmark's width,
            pushed to opposite ends. */}
        <div className="mt-4 flex w-[min(560px,82vw)] items-baseline justify-between gap-6">
          <span className="text-void/70 font-mono text-[10px] tracking-[0.2em] uppercase sm:text-[12px]">
            {siteConfig.tagline}
          </span>
          <span
            ref={readoutRef}
            className="text-void font-display text-[clamp(1.2rem,3vw,2rem)] leading-none tabular-nums"
          >
            0%
          </span>
        </div>
      </div>
    </div>
  )
}
