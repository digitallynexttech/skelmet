"use client"

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react"
import { createPortal } from "react-dom"
import Image from "next/image"

import { SkullBoundary } from "@/components/marketing/skull-boundary"
import { SkullCanvas } from "@/components/marketing/skull-canvas"
import {
  BOB_PERIOD,
  BOB_RISE,
  getSkullInteraction,
  SKULL_POSTER,
  strugglesWithModel,
} from "@/components/marketing/skull-interaction"
import { modelStored, rendersOffThread, skullWarm } from "@/components/marketing/skull-renderer"
import { afterFirstInteraction } from "@/lib/first-interaction"
import { cn } from "@/lib/utils"

/**
 * The hero object, in two layers.
 *
 * The poster is the hero. It is a frame of the mesh itself, captured from this
 * component at rest (see scripts/build-hero-poster.mjs), and it renders on the
 * server with no JavaScript at all. The 3D canvas is an enhancement laid over
 * it. It used to be a keyed product photo, and the model that replaced it was
 * visibly another picture: a flat studio shot giving way to a lit render,
 * smaller and in a different light.
 *
 * Alpha rather than a blend, because the headline runs behind this box and the
 * skull is supposed to cover it - `screen` would brighten the type showing
 * through instead, and an opaque plate would punch a rectangle out of the
 * bloom. The frame is the whole stage, the 4:5 box the canvas frames (the
 * canvas itself is drawn wider, so a turned or pitched skull has room past
 * the stage - see BLEED in skull-canvas), so the mesh lands on it pixel for
 * pixel at every size.
 *
 * That ordering is what makes the slow path bearable. The model is most of a
 * megabyte (meshopt) on top of three.js's 650KB, so there are plenty of
 * visitors who should never be asked to download it: a metered connection, 2G,
 * reduced motion, a low-end phone, a device with no WebGL, or a fetch that
 * simply fails. Every one of those lands on the poster, which is a finished
 * hero rather than a placeholder - and it is the page's main image, so it is
 * the one thing preloaded at high priority.
 *
 * The model takes over from it in a single frame. The two are the same
 * picture bobbing to the same clock (see BOB_PERIOD), and a cross-fade between
 * identical images only thins them both, showing the headline through the
 * skull halfway.
 *
 * When it starts depends on what the browser already has:
 *
 *   - A first visit waits for a sign of a person, since that is a megabyte to
 *     download; then the file and three.js come down side by side.
 *   - A browser holding the file from an earlier visit (skull-renderer keeps
 *     it) starts at once, while the splash is still up, and is on screen by
 *     the time the curtain opens.
 *   - One that has shown it in this page's lifetime, coming back from another
 *     page, still has the canvas with the skull drawn on it. It goes straight
 *     back in the hero.
 *
 * None of that is work for this thread where the browser can give a worker a
 * canvas - nearly everywhere - which is why it no longer waits for the page to
 * settle first. Where it cannot, the scene runs here, and does wait.
 *
 * The poster stays up until the model is ready every time: it used to be left
 * out on a return, and the stage stood empty until the model faded in.
 *
 * The canvas is not drawn inside this box. It is portalled to the body, into
 * a box the size of this one, and flown down the page by skull-journey: it
 * starts here, and on scroll lifts off and lands on the photographs of the
 * skull further down (see SkullDock). This element stays behind as its home -
 * `data-skull-home` is how the route finds it - along with the atmosphere and
 * the poster, which never leave the hero.
 */

/** Radians of spin per pixel dragged. */
const DRAG_SENSITIVITY = 0.008
/** Travel, in px, past which a press on the skull was a drag rather than a click. */
const CLICK_SLOP = 5

/** Drifting embers, carried over from the original hero plate. */
const EMBERS = [
  "left-[12%] bottom-[22%] size-[3px] [animation-delay:0s]",
  "left-[24%] bottom-[14%] size-1 [animation-delay:1.6s]",
  "left-[33%] bottom-[30%] size-[2px] [animation-delay:3.1s]",
  "left-[47%] bottom-[10%] size-[3px] [animation-delay:4.4s]",
  "left-[58%] bottom-[26%] size-[2px] [animation-delay:5.9s]",
  "left-[69%] bottom-[16%] size-1 [animation-delay:7.2s]",
  "left-[80%] bottom-[24%] size-[3px] [animation-delay:8.5s]",
  "left-[90%] bottom-[12%] size-[2px] [animation-delay:9.8s]",
]

/** Not in lib.dom, and absent in Safari - every read has to tolerate both. */
type NetworkInformation = { saveData?: boolean; effectiveType?: string }

/**
 * Whether this visitor has told us, one way or another, not to spend their
 * bandwidth. Absent API means no signal, which is treated as no objection.
 */
function prefersLessData(): boolean {
  const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection
  if (!connection) return false
  if (connection.saveData === true) return true
  return connection.effectiveType === "slow-2g" || connection.effectiveType === "2g"
}

/** This device, as strugglesWithModel wants it. */
function lowEndPhone(): boolean {
  return strugglesWithModel({
    touch: window.matchMedia("(pointer: coarse)").matches,
    memory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
    cores: navigator.hardwareConcurrency,
  })
}

/** After the load event, then the next idle moment - or a second, where idle callbacks don't exist. */
function afterPageSettles(run: () => void): () => void {
  let idle = 0
  let timer = 0
  const schedule = () => {
    // Safari has no requestIdleCallback.
    if (typeof window.requestIdleCallback === "function") {
      idle = window.requestIdleCallback(run, { timeout: 2000 })
    } else {
      timer = window.setTimeout(run, 1000)
    }
  }
  if (document.readyState === "complete") schedule()
  else window.addEventListener("load", schedule, { once: true })
  return () => {
    window.removeEventListener("load", schedule)
    if (idle) window.cancelIdleCallback(idle)
    window.clearTimeout(timer)
  }
}

/** Is this viewport point on the skull, wherever it currently is on the page. */
function onSkull(x: number, y: number): boolean {
  const hit = getSkullInteraction().hit
  if (!hit || hit.rx <= 0 || hit.ry <= 0) return false
  const dx = (x - hit.x) / hit.rx
  const dy = (y - hit.y) / hit.ry
  return dx * dx + dy * dy <= 1
}

export function SkullStage({ className }: { className?: string }) {
  const homeRef = useRef<HTMLDivElement>(null)
  const flightRef = useRef<HTMLDivElement>(null)
  const posterRef = useRef<HTMLImageElement>(null)

  /** Are we downloading the model at all. */
  const [attempt, setAttempt] = useState(false)
  /** Is the mesh on screen - the only thing that hides the poster. */
  const [live, setLive] = useState(false)

  const onReady = useCallback(() => {
    setLive(true)
  }, [])

  // Covers both routes a failure can take: the boundary, for anything thrown
  // during render, and the canvas itself, for the async ones it owns - a model
  // that never downloads, or a machine with no WebGL context to give. The
  // poster comes back, since a context lost after the mesh went live would
  // otherwise leave the stage empty.
  const onFailed = useCallback(() => {
    setLive(false)
  }, [])

  // Decide whether to go after the model at all, and when.
  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)")
    let cancel = () => {}

    const decide = () => {
      cancel()
      const allow = !motion.matches && !prefersLessData() && !lowEndPhone()
      if (!allow) {
        setAttempt(false)
        return
      }
      const begin = () => setAttempt(true)
      // Back from another page: the skull is still drawn on its canvas, so
      // there is nothing to wait for.
      if (skullWarm()) {
        begin()
        return
      }
      // On a first visit, not before the visitor does something: the model is
      // most of a megabyte, the poster already fills the hero, and the first
      // screen - and its speed - is the page's own. A browser that already has
      // the file has nothing to download, so it skips the wait for a person.
      //
      // Started on a worker it costs this thread nothing, so it starts at
      // once. Started here it is a second of main thread on a phone, so it
      // waits for the page to settle.
      let stopped = false
      let waiting = () => {}
      let settle = () => {}
      const start = rendersOffThread()
        ? begin
        : () => {
            settle = afterPageSettles(begin)
          }
      void modelStored().then((stored) => {
        if (stopped) return
        if (stored) start()
        else waiting = afterFirstInteraction(start)
      })
      cancel = () => {
        stopped = true
        waiting()
        settle()
      }
    }

    decide()
    motion.addEventListener("change", decide)
    return () => {
      cancel()
      motion.removeEventListener("change", decide)
    }
  }, [])

  // The atmosphere - the bloom, the arcs, the embers - only runs while the
  // hero is on screen (globals.css pauses it by this attribute). Fourteen
  // endless animations otherwise kept being worked out on every frame of
  // every scroll further down the page, for nobody.
  useEffect(() => {
    const home = homeRef.current
    if (!home) return
    const seen = new IntersectionObserver(([entry]) => {
      if (entry) home.toggleAttribute("data-away", !entry.isIntersecting)
    })
    seen.observe(home)
    return () => seen.disconnect()
  }, [])

  // Hand the mesh the poster's bob before the canvas draws its first frame. A
  // CSS animation's start time is on the document timeline, which counts from
  // the same origin as performance.now().
  useEffect(() => {
    if (!attempt) return
    const start = posterRef.current?.getAnimations()[0]?.startTime
    if (typeof start === "number") getSkullInteraction().bobEpoch = start
  }, [attempt])

  // The skull tracks the cursor anywhere on screen, and can be grabbed and
  // spun in the hero and in flight - so these listen on the window rather
  // than on this box, and hit-test against the silhouette the render loop
  // publishes. Seated in a photo it publishes none, so a press on a product
  // card is the card's. Everything else under the skull keeps working: a
  // press that is not on the skull is left alone, and a press on it that
  // never moves is still a click.
  useEffect(() => {
    if (!live) return
    const i = getSkullInteraction()
    const root = document.documentElement
    let last: { x: number; y: number } | null = null
    let travel = 0

    const setCursor = (state: "grab" | "grabbing" | null) => {
      if (state) root.dataset.skull = state
      else delete root.dataset.skull
    }

    // For the hero's "Drag to spin", which is only true from here on: the
    // poster is a picture, and a visitor who never gets the model - reduced
    // motion, data saver, a weak phone - is not told to drag it.
    root.dataset.skullLive = ""

    // The skull looks at a cursor, which is somewhere at every moment. A
    // finger is not, and a touch screen has no cursor - but it does have the
    // mouse events browsers make up after a tap, and again whenever the page
    // under that spot changes. Those left the skull staring at wherever the
    // page was last touched, usually a bottom corner, turned away from the
    // pose its poster had just been showing. So it only follows a pointer
    // that can hover.
    const hovers = window.matchMedia("(hover: hover) and (pointer: fine)").matches

    const onMove = (e: PointerEvent) => {
      if (hovers && e.pointerType !== "touch") i.cursor = { x: e.clientX, y: e.clientY }
      if (!i.dragging || !last) {
        if (e.pointerType === "mouse") setCursor(onSkull(e.clientX, e.clientY) ? "grab" : null)
        return
      }
      const dx = (e.clientX - last.x) * DRAG_SENSITIVITY
      const dy = (e.clientY - last.y) * DRAG_SENSITIVITY
      travel += Math.abs(e.clientX - last.x) + Math.abs(e.clientY - last.y)
      last = { x: e.clientX, y: e.clientY }
      i.userRot.y += dx
      i.userRot.x += dy
      // Carry the last frame's movement as momentum for the release.
      i.vel.y = dx
      i.vel.x = dy
    }

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 || !onSkull(e.clientX, e.clientY)) return
      i.dragging = true
      i.vel.x = 0
      i.vel.y = 0
      last = { x: e.clientX, y: e.clientY }
      travel = 0
      if (e.pointerType === "mouse") {
        // No text selection or native link drag starting under the skull.
        e.preventDefault()
        setCursor("grabbing")
      }
    }

    // A drag that ends over a link would otherwise click it.
    const swallowClick = (e: MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
    }

    const onUp = (e: PointerEvent) => {
      if (!i.dragging) return
      i.dragging = false
      last = null
      if (travel > CLICK_SLOP) {
        window.addEventListener("click", swallowClick, { capture: true, once: true })
        // If no click follows (released off the element), drop the trap.
        setTimeout(() => window.removeEventListener("click", swallowClick, true), 0)
      }
      setCursor(e.pointerType === "mouse" && onSkull(e.clientX, e.clientY) ? "grab" : null)
    }

    const blockWhileDragging = (e: Event) => {
      if (i.dragging) e.preventDefault()
    }

    window.addEventListener("pointermove", onMove, { passive: true })
    window.addEventListener("pointerdown", onDown, { capture: true })
    window.addEventListener("pointerup", onUp)
    window.addEventListener("pointercancel", onUp)
    window.addEventListener("dragstart", blockWhileDragging, { capture: true })
    window.addEventListener("selectstart", blockWhileDragging, { capture: true })
    return () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerdown", onDown, true)
      window.removeEventListener("pointerup", onUp)
      window.removeEventListener("pointercancel", onUp)
      window.removeEventListener("dragstart", blockWhileDragging, true)
      window.removeEventListener("selectstart", blockWhileDragging, true)
      window.removeEventListener("click", swallowClick, true)
      i.dragging = false
      i.cursor = null
      // Back to rest, so a return to the page starts the mesh where the
      // poster is: it eases toward the last pointer even before it is shown.
      for (const v of [i.pointer, i.userRot, i.vel]) v.x = v.y = 0
      setCursor(null)
      delete root.dataset.skullLive
    }
  }, [live])

  return (
    <div
      ref={homeRef}
      data-skull-home=""
      className={cn("relative select-none", className)}
      // pan-y keeps vertical page scrolling working on touch while still
      // letting a horizontal drag spin the skull.
      style={{ touchAction: "pan-y" }}
      role="img"
      aria-label={
        live
          ? "SKELMET blaze orange flame skull helmet mount, rotatable 3D preview"
          : "SKELMET blaze orange flame skull helmet mount"
      }
    >
      {/* Atmosphere, back to front. The skull is lit from behind in the 3D
          scene, so the backdrop has to carry that through or the mesh reads as
          a cut-out floating on flat black: a wide cool-edged haze, a tight
          fire core, then three arcs at different speeds to give the depth a
          reference. All of it is decorative and non-interactive. */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-1/2 size-[150%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgb(255_90_31_/_0.14),rgb(124_92_255_/_0.06)_44%,transparent_70%)] blur-[80px]"
      />
      <div
        aria-hidden
        className="animate-bloom pointer-events-none absolute top-1/2 left-1/2 size-[70%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgb(255_164_104_/_0.6),rgb(255_90_31_/_0.36)_46%,transparent_72%)] blur-[56px]"
      />

      <div
        aria-hidden
        className="animate-spin-slow border-blaze/30 pointer-events-none absolute top-1/2 left-1/2 size-[100%] -translate-x-1/2 -translate-y-1/2 rounded-full border"
      />
      <div
        aria-hidden
        className="animate-spin-rev border-blaze/35 pointer-events-none absolute top-1/2 left-1/2 size-[88%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed"
      />
      <div
        aria-hidden
        className="conic-orbit animate-spin-slow pointer-events-none absolute top-1/2 left-1/2 size-[76%] -translate-x-1/2 -translate-y-1/2 rounded-full"
      />

      {EMBERS.map((cls) => (
        <span
          key={cls}
          aria-hidden
          className={cn("animate-rise bg-ember pointer-events-none absolute rounded-full", cls)}
        />
      ))}

      {/* The poster: the mesh's own rest frame, filling the stage as the
          canvas does. Labelled by the wrapper, so it stays silent to a screen
          reader rather than announcing the same object twice. It bobs with
          the mesh's period and rise, and an easing that bends the keyframes'
          straight runs into the mesh's cosine. */}
      <Image
        ref={posterRef}
        src={SKULL_POSTER}
        alt=""
        fill
        // The page's main image: preloaded, and first in the queue.
        preload
        fetchPriority="high"
        sizes="(min-width: 1280px) 576px, (min-width: 1024px) 528px, (min-width: 640px) 480px, 410px"
        className={cn("pointer-events-none object-contain", live && "invisible")}
        style={
          {
            "--bob-rise": `${BOB_RISE * 100}%`,
            animation: live
              ? "none"
              : `skull-bob ${BOB_PERIOD}s cubic-bezier(0.37, 0, 0.63, 1) infinite`,
          } as CSSProperties
        }
      />

      {/* The flying skull. In the document rather than fixed to the viewport,
          so that docked it scrolls with its photograph natively instead of a
          frame behind it. Above the page (z-30) but under the sticky header
          and buy bar. Never takes pointer events itself: grabbing it is the
          window listeners' job, so it cannot block what it floats over.

          The outer box is the page's width and no height: it cuts the skull
          off at the screen's edges and lets it run as far down as it likes.
          Without it the canvas, which on a phone is wider than the screen,
          made the document wider too - and a phone then lays out everything
          `fixed` (the cookie card, the floating buttons) against that wider
          page, part of it off the screen. `overflow-x: hidden` on the body
          hides such overflow without stopping it counting. */}
      {attempt
        ? createPortal(
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-0 overflow-x-clip"
            >
              {/* will-change: a layer of its own from the start, so the route
                  can be run by the compositor (see skull-canvas). */}
              <div
                ref={flightRef}
                data-skull-flight=""
                className="absolute top-0 left-0 z-30 origin-top-left will-change-transform"
              >
                <SkullBoundary onError={onFailed}>
                  {/* Straight over the poster, which is this same frame. */}
                  <div className={cn("size-full", live ? "opacity-100" : "opacity-0")}>
                    <SkullCanvas flightRef={flightRef} onReady={onReady} onError={onFailed} />
                  </div>
                </SkullBoundary>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
