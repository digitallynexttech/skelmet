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
 * The hero: a poster (a rest frame of the mesh, scripts/build-hero-poster.mjs)
 * with the 3D canvas over it. The poster is the finished hero for anyone who
 * never gets the model; the canvas replaces it in one frame (same picture,
 * same bob clock). The canvas is portalled to the body and flown down the page
 * to the photos by skull-journey; `data-skull-home` marks where it starts.
 */

/** Radians of spin per pixel dragged. */
const DRAG_SENSITIVITY = 0.008
/** Travel, in px, past which a press on the skull was a drag rather than a click. */
const CLICK_SLOP = 5

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

/** Not in lib.dom, and absent in Safari. */
type NetworkInformation = { saveData?: boolean; effectiveType?: string }

/** Data saver or 2G. No API means no objection. */
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

/** After the load event, then the next idle moment. */
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
  /** The mesh is on screen: the only thing that hides the poster. */
  const [live, setLive] = useState(false)

  const onReady = useCallback(() => {
    setLive(true)
  }, [])

  // Render errors (via the boundary) and async ones (download, no WebGL, lost
  // context) all bring the poster back.
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
      // Back from another page: the skull is still on its canvas.
      if (skullWarm()) {
        begin()
        return
      }
      // A first visit waits for the first interaction (the model is about a
      // megabyte); a stored model skips that. On a worker it then starts at
      // once; on the main thread it waits for the page to settle.
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

  // The atmosphere's endless animations pause off screen (globals.css keys on data-away).
  useEffect(() => {
    const home = homeRef.current
    if (!home) return
    const seen = new IntersectionObserver(([entry]) => {
      if (entry) home.toggleAttribute("data-away", !entry.isIntersecting)
    })
    seen.observe(home)
    return () => seen.disconnect()
  }, [])

  // Hand the mesh the poster's bob phase before its first frame. A CSS
  // animation's startTime shares performance.now()'s origin.
  useEffect(() => {
    if (!attempt) return
    const start = posterRef.current?.getAnimations()[0]?.startTime
    if (typeof start === "number") getSkullInteraction().bobEpoch = start
  }, [attempt])

  // On the window, since the skull follows the cursor anywhere and can be spun
  // in flight. Presses hit-test the silhouette the render loop publishes (none
  // when seated, so the card gets it); a press off the skull, or one that never
  // moves, stays a normal click.
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

    // Shows the hero's "Drag to spin" only once there is a model to drag.
    root.dataset.skullLive = ""

    // Only a hovering pointer is followed: touch screens fire synthetic mouse
    // events after a tap, which left the skull staring at the last touch.
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
      // Reset, so a return to the page starts the mesh at the poster's pose.
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
      // Vertical scroll stays native on touch; a horizontal drag spins the skull.
      style={{ touchAction: "pan-y" }}
      role="img"
      aria-label={
        live
          ? "SKELMET blaze orange flame skull helmet mount, rotatable 3D preview"
          : "SKELMET blaze orange flame skull helmet mount"
      }
    >
      {/* Atmosphere, back to front: haze, fire core, three arcs. The scene is
          backlit, so the backdrop carries that light or the mesh reads as a cut-out. */}
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

      {/* The poster: the mesh's rest frame. The wrapper carries the label, so alt is empty.
          Bobs with the mesh's period and rise; the easing approximates its cosine. */}
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

      {/* The flying skull: absolute, not fixed, so docked it scrolls with its
          photo natively. z-30 sits under the sticky header and buy bar. No pointer
          events; the window listeners do the grabbing.
          The page-wide, zero-height box clips sideways: the canvas is wider than a
          phone and would otherwise widen the page, throwing `fixed` items off centre. */}
      {attempt
        ? createPortal(
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-0 overflow-x-clip"
            >
              {/* will-change: its own layer from the start, so the compositor runs the route. */}
              <div
                ref={flightRef}
                data-skull-flight=""
                className="absolute top-0 left-0 z-30 origin-top-left will-change-transform"
              >
                <SkullBoundary onError={onFailed}>
                  {/* No cross-fade: the poster is this same frame, and a fade thins both. */}
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
