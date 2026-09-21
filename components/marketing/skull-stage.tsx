"use client"

import dynamic from "next/dynamic"
import { useCallback, useEffect, useRef, useState } from "react"

import { getSkullInteraction } from "@/components/marketing/skull-interaction"
import { cn } from "@/lib/utils"

/**
 * `ssr: false` is rejected inside a Server Component in Next 16, which is why
 * this wrapper exists at all: the hero stays a Server Component and only this
 * leaf ships the three.js bundle.
 */
const SkullCanvas = dynamic(() => import("@/components/marketing/skull-canvas"), {
  ssr: false,
  loading: () => null,
})

/** Radians of spin per pixel dragged. */
const DRAG_SENSITIVITY = 0.008

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

export function SkullStage({ className }: { className?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const last = useRef<{ x: number; y: number } | null>(null)

  const [enabled, setEnabled] = useState(false)
  const [active, setActive] = useState(true)
  const [ready, setReady] = useState(false)

  const onReady = useCallback(() => setReady(true), [])

  // Respect reduced-motion: those users never pay for the three.js chunk.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const apply = () => setEnabled(!mq.matches)
    apply()
    mq.addEventListener("change", apply)
    return () => mq.removeEventListener("change", apply)
  }, [])

  // The skull tracks the cursor anywhere on screen, not just over the canvas.
  useEffect(() => {
    if (!enabled) return
    const onMove = (e: PointerEvent) => {
      const i = getSkullInteraction()
      i.pointer.x = (e.clientX / window.innerWidth) * 2 - 1
      i.pointer.y = (e.clientY / window.innerHeight) * 2 - 1
    }
    window.addEventListener("pointermove", onMove, { passive: true })
    return () => window.removeEventListener("pointermove", onMove)
  }, [enabled])

  // Stop the render loop once the hero leaves the viewport.
  useEffect(() => {
    const el = wrapRef.current
    if (!el || !enabled) return
    const io = new IntersectionObserver(([entry]) => setActive(Boolean(entry?.isIntersecting)), {
      rootMargin: "120px",
    })
    io.observe(el)
    return () => io.disconnect()
  }, [enabled])

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!enabled) return
    const i = getSkullInteraction()
    i.dragging = true
    i.vel.x = 0
    i.vel.y = 0
    last.current = { x: e.clientX, y: e.clientY }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const i = getSkullInteraction()
    if (!i.dragging || !last.current) return
    const dx = (e.clientX - last.current.x) * DRAG_SENSITIVITY
    const dy = (e.clientY - last.current.y) * DRAG_SENSITIVITY
    last.current = { x: e.clientX, y: e.clientY }
    i.userRot.y += dx
    i.userRot.x += dy
    // Carry the last frame's movement as momentum for the release.
    i.vel.y = dx
    i.vel.x = dy
  }

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const i = getSkullInteraction()
    if (!i.dragging) return
    i.dragging = false
    last.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }

  return (
    <div
      ref={wrapRef}
      className={cn("relative select-none", enabled && "cursor-grab active:cursor-grabbing", className)}
      // pan-y keeps vertical page scrolling working on touch while still
      // letting a horizontal drag spin the skull.
      style={{ touchAction: "pan-y" }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      role="img"
      aria-label="SKELMET blaze orange flame skull helmet mount, rotatable 3D preview"
    >
      {/* Atmosphere, back to front. The skull is lit from behind in the 3D
          scene, so the backdrop has to carry that through or the mesh reads as
          a cut-out floating on flat black: a wide cool-edged haze, a tight
          fire core, then three arcs at different speeds to give the depth a
          reference. All of it is decorative and non-interactive, so pointer
          events stay with the canvas and dragging still works over them. */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-1/2 size-[150%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgb(255_90_31_/_0.14),rgb(124_92_255_/_0.06)_44%,transparent_70%)] blur-[80px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-1/2 size-[70%] -translate-x-1/2 -translate-y-1/2 animate-bloom rounded-full bg-[radial-gradient(circle,rgb(255_164_104_/_0.6),rgb(255_90_31_/_0.36)_46%,transparent_72%)] blur-[56px]"
      />

      <div
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-1/2 size-[100%] -translate-x-1/2 -translate-y-1/2 animate-spin-slow rounded-full border border-blaze/30"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-1/2 size-[88%] -translate-x-1/2 -translate-y-1/2 animate-spin-rev rounded-full border border-dashed border-blaze/35"
      />
      <div
        aria-hidden
        className="conic-orbit pointer-events-none absolute top-1/2 left-1/2 size-[76%] -translate-x-1/2 -translate-y-1/2 animate-spin-slow rounded-full"
      />

      {EMBERS.map((cls) => (
        <span
          key={cls}
          aria-hidden
          className={cn("pointer-events-none absolute animate-rise rounded-full bg-ember", cls)}
        />
      ))}

      {/* Until the mesh is ready the stage stays empty rather than showing a
          stand-in: a flat plate popping into a 3D object reads as a glitch. */}
      {enabled ? (
        <div
          className={cn(
            "absolute inset-0 transition-opacity duration-700",
            ready ? "opacity-100" : "opacity-0",
          )}
        >
          <SkullCanvas active={active} onReady={onReady} />
        </div>
      ) : null}
    </div>
  )
}
