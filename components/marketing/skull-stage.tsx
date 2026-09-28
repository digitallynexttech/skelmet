"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import dynamic from "next/dynamic"
import Image from "next/image"

import { SkullBoundary } from "@/components/marketing/skull-boundary"
import { getSkullInteraction } from "@/components/marketing/skull-interaction"
import { afterFirstInteraction } from "@/lib/first-interaction"
import { cn } from "@/lib/utils"

/**
 * The hero object, in two layers.
 *
 * The poster is the hero. It is the front-on product shot keyed to real alpha
 * (see scripts/build-hero-poster.mjs), and it renders on the server with no
 * JavaScript at all. The 3D canvas is an enhancement laid over it.
 *
 * Alpha rather than a blend, because the headline runs behind this box and the
 * skull is supposed to cover it - `screen` would brighten the type showing
 * through instead, and an opaque plate would punch a rectangle out of the
 * bloom. The cutout is posed and sized to sit where the mesh sits, so the
 * hand-off between them is close to invisible.
 *
 * That ordering is what makes the slow path bearable. The model is about 1MB
 * (meshopt) on top of a ~650KB three.js chunk, so there are plenty of visitors
 * who should never be asked to download it: a metered connection, 2G, reduced
 * motion, a low-end phone, a device with no WebGL, or a fetch that simply
 * fails. Every one of those lands on the poster, which is a finished hero
 * rather than a placeholder - and it is the page's main image, so it is the one
 * thing preloaded at high priority.
 *
 * The model waits its turn: nothing is fetched until the page has loaded and
 * gone idle, so it never competes with the poster, the fonts or hydration. It
 * then cross-fades in over the poster. Once it has been on screen, coming back
 * to the page starts without the poster, so the photo never flashes before the
 * model, whose parsed file skull-canvas keeps for the rest of the session.
 *
 * The canvas is not drawn inside this box. It is portalled to the body, into
 * a box the size of this one, and flown down the page by skull-journey: it
 * starts here, and on scroll lifts off and lands on the photographs of the
 * skull further down (see SkullDock). This element stays behind as its home -
 * `data-skull-home` is how the route finds it - along with the atmosphere and
 * the poster, which never leave the hero.
 *
 * `ssr: false` is rejected inside a Server Component in Next 16, which is why
 * this wrapper exists at all: the hero stays a Server Component and only this
 * leaf ships the three.js bundle.
 */
const SkullCanvas = dynamic(() => import("@/components/marketing/skull-canvas"), {
  ssr: false,
  loading: () => null,
})

/**
 * Where the mesh sits in frame, so the poster can be put in the same place.
 *
 * The canvas camera is at z=5.4 with a 32° vertical fov, so it sees
 * 2 * 5.4 * tan(16°) = 3.096 units at the origin. skull-canvas normalises the
 * model's longest axis - its height - to 2.5 of those units and lifts it by
 * OPTICAL_CENTRE_LIFT (0.06). Both fall out as a share of the stage height.
 */
const MESH_HEIGHT_RATIO = 80.7 // 2.5 / 3.096
const MESH_LIFT_RATIO = 1.9 // 0.06 / 3.096

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

/**
 * A phone that would struggle: 4 GB or less of memory, or 4 cores or fewer, on
 * a touch screen. It keeps the poster - the model would cost it a megabyte and
 * seconds of main thread for a decoration. Absent APIs (Safari has no
 * deviceMemory) count as capable.
 */
function lowEndPhone(): boolean {
  if (!window.matchMedia("(pointer: coarse)").matches) return false
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
  const cores = navigator.hardwareConcurrency
  return (memory !== undefined && memory <= 4) || (cores !== undefined && cores <= 4)
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

/**
 * The model has been on screen at least once in this page's lifetime. Client
 * code only; a module binding on the server would be shared between visitors.
 */
let modelShown = false

/** Is this viewport point on the skull, wherever it currently is on the page. */
function onSkull(x: number, y: number): boolean {
  const hit = getSkullInteraction().hit
  if (!hit || hit.rx <= 0 || hit.ry <= 0) return false
  const dx = (x - hit.x) / hit.rx
  const dy = (y - hit.y) / hit.ry
  return dx * dx + dy * dy <= 1
}

export function SkullStage({ className }: { className?: string }) {
  const flightRef = useRef<HTMLDivElement>(null)

  /** Are we downloading the model at all. */
  const [attempt, setAttempt] = useState(false)
  /** Is the mesh on screen - the only thing that hides the poster. */
  const [live, setLive] = useState(false)
  /**
   * Coming back to a page where the model has already been seen: leave the
   * poster out, so the stage waits a beat for the model rather than showing
   * the photo and swapping. Read in the initialiser so not even the first
   * frame shows the photo. That is hydration-safe: the flag is only ever true
   * after a client-side navigation, never on a fresh page load.
   */
  const [returning, setReturning] = useState(() => typeof window !== "undefined" && modelShown)

  const onReady = useCallback(() => {
    modelShown = true
    setLive(true)
  }, [])

  // Covers both routes a failure can take: the boundary, for anything thrown
  // during render, and the canvas itself, for the async ones it owns - a model
  // that never downloads, or a machine with no WebGL context to give. The
  // poster comes back, since a context lost after the mesh went live would
  // otherwise leave the stage empty.
  const onFailed = useCallback(() => {
    setLive(false)
    setReturning(false)
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
        setReturning(false)
        return
      }
      // Seen already: the file is parsed and cached, so there is nothing to
      // wait for and no reason to show the poster first.
      if (modelShown) {
        setReturning(true)
        setAttempt(true)
        return
      }
      // First visit: not before the visitor does something, then not before
      // the page has settled. The model is a megabyte and a second of main
      // thread on a phone; the poster already fills the hero, so the first
      // screen - and its speed - is the page's own, and the model arrives
      // while they are reading.
      let settle = () => {}
      const waiting = afterFirstInteraction(() => {
        settle = afterPageSettles(() => setAttempt(true))
      })
      cancel = () => {
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

  // The skull tracks the cursor anywhere on screen, and can be grabbed and
  // spun wherever it has flown to - so these listen on the window rather than
  // on this box, and hit-test against the silhouette the render loop
  // publishes. Everything else under the skull keeps working: a press that is
  // not on the skull is left alone, and a press on it that never moves is
  // still a click, so the skull docked on a product card opens the product.
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

    const onMove = (e: PointerEvent) => {
      i.cursor = { x: e.clientX, y: e.clientY }
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
      setCursor(null)
    }
  }, [live])

  return (
    <div
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

      {/* The poster, placed where the mesh lands rather than stretched to the
          box. Labelled by the wrapper, so it stays silent to a screen reader
          rather than announcing the same object twice. The drift is the
          poster's answer to the idle bob the mesh does in useFrame. */}
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
        style={{ translate: `0 -${MESH_LIFT_RATIO}%` }}
      >
        <Image
          src="/product/hero-skull-cutout.webp"
          alt=""
          width={836}
          height={1376}
          // The page's main image: preloaded, and first in the queue.
          preload
          fetchPriority="high"
          sizes="(min-width: 1024px) 360px, (min-width: 640px) 300px, 260px"
          className={cn(
            "w-auto object-contain",
            "transition-opacity duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]",
            // The drift stops once the model has taken over.
            live || returning ? "opacity-0" : "animate-drift",
          )}
          style={{ height: `${MESH_HEIGHT_RATIO}%` }}
        />
      </div>

      {/* The flying skull. In the document rather than fixed to the viewport,
          so that docked it scrolls with its photograph natively instead of a
          frame behind it. Above the page (z-30) but under the sticky header
          and buy bar. Never takes pointer events itself: grabbing it is the
          window listeners' job, so it cannot block what it floats over. */}
      {attempt
        ? createPortal(
            <div
              ref={flightRef}
              aria-hidden
              className="pointer-events-none absolute top-0 left-0 z-30 origin-top-left"
            >
              <SkullBoundary onError={onFailed}>
                <div
                  className={cn(
                    "ease-out-expo size-full transition-opacity duration-700",
                    live ? "opacity-100" : "opacity-0",
                  )}
                >
                  <SkullCanvas flightRef={flightRef} onReady={onReady} onError={onFailed} />
                </div>
              </SkullBoundary>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
