"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"
import Image from "next/image"

import { SkullBoundary } from "@/components/marketing/skull-boundary"
import { getSkullInteraction } from "@/components/marketing/skull-interaction"
import { holdSplash } from "@/components/shared/splash-gate"
import { cn } from "@/lib/utils"

/**
 * The hero object, in two layers.
 *
 * The poster is the hero. It is the front-on product shot keyed to real alpha
 * (see scripts/build-hero-poster.mjs), and it renders on the server with no
 * JavaScript at all. The 3D canvas is an enhancement laid over it.
 *
 * Alpha rather than a blend, because the headline runs behind this box and the
 * skull is supposed to cover it — `screen` would brighten the type showing
 * through instead, and an opaque plate would punch a rectangle out of the
 * bloom. The cutout is posed and sized to sit where the mesh sits, so the
 * hand-off between them is close to invisible.
 *
 * That ordering is what makes the slow path bearable. The model is 8.7MB on
 * top of a ~900KB three.js chunk, so there are plenty of visitors who should
 * never be asked to download it: a metered connection, 2G, reduced motion, a
 * device with no WebGL, or a fetch that simply fails. Every one of those cases
 * lands on the poster, which is a finished hero rather than a placeholder —
 * the treatment this section shipped with before the model existed.
 *
 * While the model is in flight the stage holds the splash down, so on a
 * healthy connection the swap happens behind the visor and nobody watches the
 * skull arrive. The splash has its own ceiling, so a slow model delays nothing:
 * the visor lifts on schedule, the poster is already there, and the canvas
 * cross-fades in later if it makes it.
 *
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

/**
 * Where the mesh sits in frame, so the poster can be put in the same place.
 *
 * The canvas camera is at z=5.4 with a 32° vertical fov, so it sees
 * 2 * 5.4 * tan(16°) = 3.096 units at the origin. skull-canvas normalises the
 * model's longest axis — its height — to 2.5 of those units and lifts it by
 * OPTICAL_CENTRE_LIFT (0.06). Both fall out as a share of the stage height.
 */
const MESH_HEIGHT_RATIO = 80.7 // 2.5 / 3.096
const MESH_LIFT_RATIO = 1.9 // 0.06 / 3.096

/** Not in lib.dom, and absent in Safari — every read has to tolerate both. */
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

export function SkullStage({ className }: { className?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const last = useRef<{ x: number; y: number } | null>(null)
  const release = useRef<(() => void) | null>(null)

  /** Are we downloading the model at all. */
  const [attempt, setAttempt] = useState(false)
  /** Is the mesh on screen — the only thing that hides the poster. */
  const [live, setLive] = useState(false)
  const [active, setActive] = useState(true)

  const releaseSplash = useCallback(() => {
    release.current?.()
    release.current = null
  }, [])

  const onReady = useCallback(() => {
    setLive(true)
    releaseSplash()
  }, [releaseSplash])

  // Covers both routes a failure can take: the boundary, for anything thrown
  // during render, and the canvas itself, for the async ones it owns — a model
  // that never downloads, or a machine with no WebGL context to give. Put the
  // poster back as well as releasing the splash, since a context lost after the
  // mesh went live would otherwise leave the stage empty.
  const onFailed = useCallback(() => {
    setLive(false)
    releaseSplash()
  }, [releaseSplash])

  // Decide whether to go after the model, and hold the splash while we do.
  //
  // The hold is taken first and dropped immediately if the answer is no, so
  // there is no window where the splash could sample the count mid-decision.
  // An effect is early enough by a wide margin: the splash cannot begin
  // leaving before its own minimum hold, which is three orders of magnitude
  // further out than this frame.
  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)")

    const decide = () => {
      const allow = !motion.matches && !prefersLessData()
      setAttempt(allow)
      if (!allow) releaseSplash()
    }

    release.current = holdSplash()
    decide()

    motion.addEventListener("change", decide)
    return () => {
      motion.removeEventListener("change", decide)
      releaseSplash()
    }
  }, [releaseSplash])

  // The skull tracks the cursor anywhere on screen, not just over the canvas.
  useEffect(() => {
    if (!live) return
    const onMove = (e: PointerEvent) => {
      const i = getSkullInteraction()
      i.pointer.x = (e.clientX / window.innerWidth) * 2 - 1
      i.pointer.y = (e.clientY / window.innerHeight) * 2 - 1
    }
    window.addEventListener("pointermove", onMove, { passive: true })
    return () => window.removeEventListener("pointermove", onMove)
  }, [live])

  // Stop the render loop once the hero leaves the viewport.
  useEffect(() => {
    const el = wrapRef.current
    if (!el || !attempt) return
    const io = new IntersectionObserver(([entry]) => setActive(Boolean(entry?.isIntersecting)), {
      rootMargin: "120px",
    })
    io.observe(el)
    return () => io.disconnect()
  }, [attempt])

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!live) return
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
      className={cn(
        "relative select-none",
        live && "cursor-grab active:cursor-grabbing",
        className,
      )}
      // pan-y keeps vertical page scrolling working on touch while still
      // letting a horizontal drag spin the skull.
      style={{ touchAction: "pan-y" }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
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
          reference. All of it is decorative and non-interactive, so pointer
          events stay with the canvas and dragging still works over them. */}
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
          priority
          sizes="(min-width: 1024px) 360px, 260px"
          className={cn(
            "animate-drift w-auto object-contain",
            "transition-opacity duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]",
            live && "opacity-0",
          )}
          style={{ height: `${MESH_HEIGHT_RATIO}%` }}
        />
      </div>

      {attempt ? (
        <SkullBoundary onError={onFailed}>
          <div
            className={cn(
              "absolute inset-0 transition-opacity duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]",
              live ? "opacity-100" : "opacity-0",
            )}
          >
            <SkullCanvas active={active} onReady={onReady} onError={onFailed} />
          </div>
        </SkullBoundary>
      ) : null}
    </div>
  )
}
