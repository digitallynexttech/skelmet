"use client"

import { useEffect, useRef, type RefObject } from "react"

import { getSkullInteraction, HALO_REST } from "@/components/marketing/skull-interaction"
import {
  journey,
  measureAnchors,
  REST_SILHOUETTE,
  type Anchor,
  type Pose,
  type Silhouette,
} from "@/components/marketing/skull-journey"
import { BLEED, haloPointOf, haloRadiusOf, silhouetteOf } from "@/components/marketing/skull-optics"
import { mountSkull } from "@/components/marketing/skull-renderer"

/**
 * The hero skull on the page: where its canvas is and how it is turned; the
 * scene is skull-renderer's. The route moves the box, not the camera, as
 * scroll-driven keyframes on the compositor where supported (moved a frame
 * behind the scroll, it shivers). Rotation: `follow` (eased toward the cursor)
 * + `userRot` (drag spin with momentum, decaying to 0) + the route's.
 */

/** How far the look-at pose swings at the edges of the viewport (radians). */
const MAX_YAW = 0.55
const MAX_PITCH = 0.3
/** Per-second retention: lower = snappier. Used with delta for frame independence. */
const FOLLOW_SMOOTHING = 0.002
const SPIN_FRICTION = 0.94
const RETURN_FRICTION = 0.965

/** Larger than the flying box it sits in, by the bleed, and centred on it. */
const BLEED_STYLE = {
  position: "absolute",
  left: `${(-(BLEED.x - 1) / 2) * 100}%`,
  top: `${(-(BLEED.y - 1) / 2) * 100}%`,
  width: `${BLEED.x * 100}%`,
  height: `${BLEED.y * 100}%`,
} as const

/** Flare per radian-per-second of spin, and its ceiling. */
const HALO_FLARE_GAIN = 0.03
const HALO_FLARE_MAX = 0.35

/** Roll per px/s of sideways flight, and its ceiling: the skull banks into its turns. */
const BANK_GAIN = 0.0003
const BANK_MAX = 0.3

/** Still frames (half a second) before the loop stops; scroll, pointer or layout restarts it. */
const REST_AFTER = 30

/** Keyframe spacing along the route, px of scroll: the chords stay within a fifth of a pixel. */
const ROUTE_STEP = 12

/** Not in lib.dom yet. Firefox lacks it and takes the frame-by-frame path. */
type ScrollTimelineConstructor = new (options: {
  source: Element
  axis: "block"
}) => AnimationTimeline

export function SkullCanvas({
  flightRef,
  onReady,
  onError,
}: {
  /** The positioned box the canvas fills, which is flown down the page. */
  flightRef: RefObject<HTMLDivElement | null>
  onReady: () => void
  onError: (reason: unknown) => void
}) {
  const hostRef = useRef<HTMLDivElement>(null)

  // Behind refs so a parent re-render never takes the canvas off the page.
  // Synced in an effect declared above the main one, so it runs first.
  const readyRef = useRef(onReady)
  const errorRef = useRef(onError)

  useEffect(() => {
    readyRef.current = onReady
    errorRef.current = onError
  })

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    let frame = 0
    /** The skull is drawn: the route may seat it on photographs, and it may be grabbed. */
    let ready = false

    // The model's surface, from the scene once loaded: the outline is measured off it at any angle.
    let surface: Float32Array | null = null
    const extent = { width: 0, depth: 0 }
    const box = { width: 0, height: 0 }
    const silhouettes = new Map<string, Silhouette>()
    const silhouette = (turn: number, pitch: number): Silhouette => {
      if (!surface || box.height === 0) return REST_SILHOUETTE
      // Quantised, so a flight easing between two angles reuses its answers.
      const yaw = Math.round(turn * 200) / 200
      const nod = Math.round(pitch * 200) / 200
      const key = `${yaw}:${nod}`
      const known = silhouettes.get(key)
      if (known) return known
      const measured = silhouetteOf(surface, box.width / box.height, yaw, nod)
      silhouettes.set(key, measured)
      return measured
    }

    /** The box for a pose: sized so the outline matches the photo, scaled about its top left. */
    const place = (pose: Pose) => {
      const shape = silhouette(pose.turn, pose.pitch)
      const s = pose.h / (shape.height * box.height)
      const w = box.width * s
      const h = box.height * s
      const left = pose.cx - shape.centreX * w
      const top = pose.cy - shape.centreY * h
      return { s, w, h, left, top }
    }
    const transformOf = ({ left, top, s }: { left: number; top: number; s: number }) =>
      `translate3d(${left.toFixed(2)}px, ${top.toFixed(2)}px, 0) scale(${s.toFixed(5)})`

    let anchors: Anchor[] = []
    const written = { transform: "", clip: "" }
    const plates = new Map<HTMLElement, number>()

    /** The route as a scroll-driven animation; null without support, and the loop moves the box. */
    const ScrollTimeline = (window as unknown as { ScrollTimeline?: ScrollTimelineConstructor })
      .ScrollTimeline
    let route: Animation | null = null
    /** What the current route was charted from, so an unchanged page keeps it. */
    let charted = ""
    const chart = () => {
      const flight = flightRef.current
      const scroller = document.scrollingElement
      const end = scroller ? scroller.scrollHeight - scroller.clientHeight : 0
      const vw = document.documentElement.clientWidth
      const vh = window.innerHeight
      if (!ScrollTimeline || !flight || !scroller || box.height === 0 || end <= 0) {
        route?.cancel()
        route = null
        charted = ""
        return
      }

      // Re-chart only when an input changes: every image load resizes the body.
      const from = [
        end,
        vw,
        vh,
        box.width,
        box.height,
        surface?.length ?? 0,
        ...anchors.flatMap((a) => [a.cx.toFixed(1), a.cy.toFixed(1), a.h.toFixed(1), a.turn]),
      ].join(" ")
      if (route && from === charted) return

      // Runs of one transform (a seated skull) keep only their ends.
      const frames: Keyframe[] = []
      let run: Keyframe | null = null
      for (let y = 0; ; y = Math.min(end, y + ROUTE_STEP)) {
        const pose = journey(anchors, y, vw, vh)
        if (!pose) break
        const key = { offset: y / end, transform: transformOf(place(pose)) }
        if (key.transform !== frames.at(-1)?.transform) {
          if (run) frames.push(run)
          frames.push(key)
          run = null
        } else {
          run = key
        }
        if (y >= end) break
      }
      if (run) frames.push(run)

      route?.cancel()
      route = null
      charted = ""
      if (frames.length < 2) return

      // A new animation starts a frame late and the box shows its inline transform until then.
      const here = journey(anchors, window.scrollY, vw, vh)
      if (here) {
        written.transform = transformOf(place(here))
        flight.style.transform = written.transform
      }
      try {
        route = flight.animate(frames, {
          timeline: new ScrollTimeline({ source: scroller, axis: "block" }),
          fill: "both",
        })
        charted = from
      } catch {
        // An engine that has the constructor and not the rest: frame by frame.
        route = null
      }
    }

    // Re-measured whenever layout can move, inside the observer callback (before
    // paint), so a seated skull moves in the same frame as the content above it.
    let stale = true
    const remeasure = () => {
      measure()
      wake()
    }
    const measure = () => {
      stale = false
      const flight = flightRef.current
      const home = document.querySelector<HTMLElement>("[data-skull-home]")
      if (!flight || !home) return
      // The flying box is the hero stage's size, so at home it is the stage.
      const rect = home.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return
      if (rect.width !== box.width || rect.height !== box.height) {
        silhouettes.clear()
        box.width = rect.width
        box.height = rect.height
        flight.style.width = `${rect.width}px`
        flight.style.height = `${rect.height}px`
      }
      anchors = measureAnchors(silhouette(0, 0))
      // A photo dropped from the route (e.g. resized to a phone) gets its own skull back.
      for (const el of plates.keys()) {
        if (anchors.some((a) => a.el === el)) continue
        el.style.removeProperty("--skull-dock")
        plates.delete(el)
      }
      chart()
      // Without a route the loop places the box a frame late; place it now.
      if (!route) {
        const here = journey(
          anchors,
          window.scrollY,
          document.documentElement.clientWidth,
          window.innerHeight,
        )
        if (here) {
          written.transform = transformOf(place(here))
          flight.style.transform = written.transform
        }
      }
    }

    /** Hand every photo its own skull back, and stop offering this one for grabs. */
    const release = () => {
      for (const el of plates.keys()) el.style.removeProperty("--skull-dock")
      plates.clear()
      const i = getSkullInteraction()
      i.box = null
      i.hit = null
    }

    const skull = mountSkull(host, {
      onReady: (info) => {
        surface = info.surface
        extent.width = info.extent[0]
        extent.depth = info.extent[2]
        ready = true
        // Home is placed by the outline too; now it is known exactly.
        silhouettes.clear()
        measure()
        wake()
        readyRef.current()
      },
      onFailed: (reason) => {
        ready = false
        release()
        errorRef.current(reason)
      },
    })

    const resize = () => skull.size(host.clientWidth, host.clientHeight)
    const observer = new ResizeObserver(resize)
    observer.observe(host)

    window.addEventListener("resize", remeasure, { passive: true })
    const layout = new ResizeObserver(remeasure)
    layout.observe(document.body)
    void document.fonts?.ready.then(remeasure)

    const follow = { x: 0, y: 0 }
    const lastRot = { x: 0, y: 0 }
    /** What the scene was last told, so a still skull sends nothing. */
    const told = { x: NaN, y: NaN, z: NaN, bob: NaN, studio: NaN, clock: NaN, visible: true }
    let bank = 0
    let lastCx = NaN
    let flare = 0
    let last = performance.now()
    /** Where the page was on the last frame, to tell a still page from a moving one. */
    const seen = { scroll: NaN, vw: 0, vh: 0 }

    /** One frame. True if anything was in motion, so another frame is wanted. */
    const step = (): boolean => {
      // Clamped: a background tab, a long GC or the first frame after a rest must not fling it.
      const now = performance.now()
      const d = Math.min((now - last) / 1000, 0.05)
      last = now

      let moving = stale
      if (stale) measure()

      const i = getSkullInteraction()
      const flight = flightRef.current
      const scroll = window.scrollY
      const vw = document.documentElement.clientWidth
      const vh = window.innerHeight
      if (scroll !== seen.scroll || vw !== seen.vw || vh !== seen.vh) moving = true
      seen.scroll = scroll
      seen.vw = vw
      seen.vh = vh
      const pose = journey(anchors, scroll, vw, vh)
      if (!pose || !flight || box.height === 0) return moving

      // Place the box, unless the keyframes already do.
      const placed = place(pose)
      const { s, w, h, left, top } = placed
      if (!route) {
        const transform = transformOf(placed)
        if (transform !== written.transform) {
          flight.style.transform = transform
          written.transform = transform
        }
      }

      // The crop: an inset of the canvas (box plus bleed), in its unscaled pixels.
      const hostLeft = left - ((BLEED.x - 1) / 2) * w
      const hostTop = top - ((BLEED.y - 1) / 2) * h
      const clip = pose.clip
        ? `inset(${[
            pose.clip.top - hostTop,
            hostLeft + w * BLEED.x - pose.clip.right,
            hostTop + h * BLEED.y - pose.clip.bottom,
            pose.clip.left - hostLeft,
          ]
            .map((v) => `${Math.max(0, v / s).toFixed(1)}px`)
            .join(" ")})`
        : "none"
      if (clip !== written.clip) {
        host.style.clipPath = clip
        written.clip = clip
      }

      const visible = top - scroll < vh && top - scroll + h > 0

      if (ready) {
        for (const [el, weight] of pose.plates) {
          const was = plates.get(el) ?? 0
          if (Math.abs(weight - was) < 0.004 && !(weight === 0 && was !== 0)) continue
          plates.set(el, weight)
          el.style.setProperty("--skull-dock", weight.toFixed(3))
        }
        i.box = { x: left, y: top - scroll, w, h }
        // Not grabbable once seated: a press on the card is for the card.
        i.hit =
          visible && pose.docked < 0.5
            ? { x: pose.cx, y: pose.cy - scroll, rx: i.halo.r * h, ry: pose.h / 2 }
            : null
      }

      // Look at the cursor from where the skull is, not from the screen's centre.
      if (i.cursor) {
        i.pointer.x = Math.max(-1, Math.min(1, (i.cursor.x - pose.cx) / (vw / 2)))
        i.pointer.y = Math.max(-1, Math.min(1, (i.cursor.y - (pose.cy - scroll)) / (vh / 2)))
      }

      if (visible !== told.visible) {
        told.visible = visible
        skull.visible(visible)
      }
      if (!visible) return moving

      if (!i.dragging) {
        i.userRot.x += i.vel.x
        i.userRot.y += i.vel.y
        i.vel.x *= SPIN_FRICTION
        i.vel.y *= SPIN_FRICTION
        i.userRot.x *= RETURN_FRICTION
        i.userRot.y *= RETURN_FRICTION
      }

      const t = 1 - Math.pow(FOLLOW_SMOOTHING, d)
      // Positive rotation.x tips the face down and pointer.y grows downward: same sign.
      follow.x += (i.pointer.y * MAX_PITCH - follow.x) * t
      follow.y += (i.pointer.x * MAX_YAW - follow.y) * t

      // Bank into sideways flight, and settle level again once it stops.
      if (d > 0 && Number.isFinite(lastCx)) {
        const lean = Math.max(-BANK_MAX, Math.min(BANK_MAX, (-(pose.cx - lastCx) / d) * BANK_GAIN))
        bank += (lean - bank) * t
      }
      lastCx = pose.cx

      // Seated in a photo it holds still (no follow, no drag) like the photos
      // beside it; the hold fades in over the landing.
      const free = 1 - pose.docked
      const rx = (follow.x + i.userRot.x) * free + pose.pitch
      const ry = (follow.y + i.userRot.y) * free + pose.spin + pose.turn
      const rz = bank

      // Stage light in flight, studio light once seated; quantised as in the scene.
      const studio = Math.round(pose.docked * 200) / 200
      if (
        Math.abs(rx - told.x) > 1e-5 ||
        Math.abs(ry - told.y) > 1e-5 ||
        Math.abs(rz - told.z) > 1e-5 ||
        Math.abs(pose.bob - told.bob) > 1e-3 ||
        studio !== told.studio
      ) {
        told.x = rx
        told.y = ry
        told.z = rz
        told.bob = pose.bob
        told.studio = studio
        skull.pose({ x: rx, y: ry, z: rz, bob: pose.bob, studio })
        moving = true
      }
      // The poster's bob epoch (see BOB_PERIOD); the stage sets it after this mounts.
      if (i.bobEpoch !== told.clock) {
        told.clock = i.bobEpoch
        skull.clock(i.bobEpoch)
      }

      if (ready) {
        // Where the headline burns: the crown, projected by the scene's camera.
        const point = haloPointOf(rx, ry, rz, box.width / box.height)

        // A fling flares the burn. Only the visitor's own turning counts: the
        // route's spin wraps a full turn on landing.
        const ownPitch = follow.x + i.userRot.x
        const ownYaw = follow.y + i.userRot.y
        if (d > 0) {
          const spin = Math.hypot(ownPitch - lastRot.x, ownYaw - lastRot.y) / d
          flare += (Math.min(spin * HALO_FLARE_GAIN, HALO_FLARE_MAX) - flare) * t
        }
        lastRot.x = ownPitch
        lastRot.y = ownYaw

        i.halo.x = point.x
        i.halo.y = point.y
        i.halo.r = haloRadiusOf(ry, extent.width, extent.depth)
        i.halo.flare = flare
      }

      return (
        moving ||
        i.dragging ||
        Math.abs(i.vel.x) + Math.abs(i.vel.y) > 1e-5 ||
        Math.abs(i.userRot.x) + Math.abs(i.userRot.y) > 1e-4 ||
        Math.abs(bank) > 1e-4 ||
        flare > 1e-3
      )
    }

    /** Frames in a row in which nothing moved. */
    let still = 0
    function loop() {
      frame = 0
      still = step() ? 0 : still + 1
      if (still < REST_AFTER) frame = requestAnimationFrame(loop)
    }
    function wake() {
      still = 0
      if (!frame) frame = requestAnimationFrame(loop)
    }
    wake()

    // What can set the skull moving again once the loop has stopped.
    const stirred = { passive: true } as const
    window.addEventListener("scroll", wake, stirred)
    window.addEventListener("pointermove", wake, stirred)
    window.addEventListener("pointerdown", wake, stirred)
    window.addEventListener("pointerup", wake, stirred)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("scroll", wake)
      window.removeEventListener("pointermove", wake)
      window.removeEventListener("pointerdown", wake)
      window.removeEventListener("pointerup", wake)
      observer.disconnect()
      layout.disconnect()
      window.removeEventListener("resize", remeasure)
      route?.cancel()
      // Canvas and scene are kept, not destroyed: a return to this page puts them back.
      skull.unmount()
      // The poster takes over, in the rest pose.
      ready = false
      release()
      Object.assign(getSkullInteraction().halo, HALO_REST)
    }
  }, [flightRef])

  return <div ref={hostRef} style={BLEED_STYLE} />
}

export default SkullCanvas
