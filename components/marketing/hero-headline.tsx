"use client"

import { useEffect, useRef, type ReactNode } from "react"

import { getSkullInteraction } from "@/components/marketing/skull-interaction"
import { cn } from "@/lib/utils"

/**
 * The hero line, burnt to an outline where the skull meets it: four stacked copies
 * (`.burn` in globals.css) masked by an ellipse that follows the skull.
 * Must render inside the hero stage, which stands in for the canvas on the poster path.
 * Only the first copy is the h1, so screen readers and crawlers get the line once.
 */

/**
 * Burn reach from the skull's centre: a share of its half-width plus headline heights.
 * Inside HOLLOW only outline, outside SOLID only paint. Fitted at 1536 and 390 wide.
 */
const HOLLOW = { skull: 0.69, line: 0.72 }
const SOLID = { skull: 0.69, line: 1.64 }
/** Halo height to width; above 1 so it bends round the dome. */
const HALO_ASPECT = 1.6
/** Smallest change, in percent of the headline box, worth a style write. */
const EPSILON = 0.02

export function HeroHeadline({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    const frame = el?.parentElement
    if (!el || !frame) return

    // Document pixels, after the headline's transform; mask percentages hold either way.
    const box = { left: 0, top: 0, width: 1, height: 1 }
    const stage = { left: 0, top: 0, width: 1, height: 1 }
    const last = { x: NaN, y: NaN, rx: NaN, ry: NaN, inner: NaN }
    let parked = false

    const measure = () => {
      const a = el.getBoundingClientRect()
      const b = frame.getBoundingClientRect()
      if (a.width === 0 || a.height === 0) return
      box.left = a.left + window.scrollX
      box.top = a.top + window.scrollY
      box.width = a.width
      box.height = a.height
      stage.left = b.left + window.scrollX
      stage.top = b.top + window.scrollY
      stage.width = b.width
      stage.height = b.height
      // Geometry moved, so force the next write.
      last.x = NaN
      parked = false
    }

    const write = () => {
      const { halo, box: live } = getSkullInteraction()
      // Relative to the headline, in viewport terms: the live canvas box can be anywhere.
      const originX = box.left - window.scrollX
      const originY = box.top - window.scrollY
      const canvas = live ?? {
        x: stage.left - window.scrollX,
        y: stage.top - window.scrollY,
        w: stage.width,
        h: stage.height,
      }
      const skull = halo.r * canvas.h
      const centreX = canvas.x + halo.x * canvas.w - originX
      const centreY = canvas.y + halo.y * canvas.h - originY
      // A spinning skull throws its heat further.
      const reach = 1 + halo.flare
      const hollow = (HOLLOW.skull * skull + HOLLOW.line * box.height) * reach
      const solid = (SOLID.skull * skull + SOLID.line * box.height) * reach

      // The skull can sit well below the line: size the ellipse so its stops still
      // cross the line's middle at `hollow` and `solid`.
      const offset = (centreY - box.height / 2) / HALO_ASPECT
      const outer = Math.hypot(solid, offset)
      const inner = (Math.hypot(hollow, offset) / outer) * 100

      // Skull clear of the line: park the halo (a zero-size gradient is full paint)
      // and stop repainting four layers of type every frame.
      const clear =
        centreX + outer < 0 ||
        centreX - outer > box.width ||
        centreY + outer * HALO_ASPECT < 0 ||
        centreY - outer * HALO_ASPECT > box.height
      if (clear) {
        if (parked) return
        parked = true
        last.x = NaN
        el.style.setProperty("--hrx", "0%")
        el.style.setProperty("--hry", "0%")
        return
      }
      parked = false

      const x = (centreX / box.width) * 100
      const y = (centreY / box.height) * 100
      const rx = (outer / box.width) * 100
      const ry = ((outer * HALO_ASPECT) / box.height) * 100

      if (
        Math.abs(x - last.x) < EPSILON &&
        Math.abs(y - last.y) < EPSILON &&
        Math.abs(rx - last.rx) < EPSILON &&
        Math.abs(ry - last.ry) < EPSILON &&
        Math.abs(inner - last.inner) < EPSILON
      ) {
        return
      }

      last.x = x
      last.y = y
      last.rx = rx
      last.ry = ry
      last.inner = inner
      el.style.setProperty("--hx", `${x.toFixed(2)}%`)
      el.style.setProperty("--hy", `${y.toFixed(2)}%`)
      el.style.setProperty("--hrx", `${rx.toFixed(2)}%`)
      el.style.setProperty("--hry", `${ry.toFixed(2)}%`)
      el.style.setProperty("--hin", `${inner.toFixed(2)}%`)
    }

    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      write()
    }
    const start = () => {
      if (!raf) raf = requestAnimationFrame(tick)
    }
    const stop = () => {
      cancelAnimationFrame(raf)
      raf = 0
    }

    measure()
    write()

    // The display face may still be swapping in.
    let alive = true
    void document.fonts?.ready.then(() => {
      if (alive) measure()
    })

    const resize = new ResizeObserver(measure)
    resize.observe(el)
    resize.observe(frame)
    // Crossing xl changes the headline's scale, which ResizeObserver does not see.
    window.addEventListener("resize", measure, { passive: true })

    const visible = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) start()
      else stop()
    })
    visible.observe(el)

    return () => {
      alive = false
      stop()
      resize.disconnect()
      visible.disconnect()
      window.removeEventListener("resize", measure)
    }
  }, [])

  return (
    <div ref={ref} className={cn("burn", className)}>
      <h1 className="burn-paint">{children}</h1>
      <div aria-hidden data-nosnippet className="burn-heat">
        {children}
      </div>
      <div aria-hidden data-nosnippet className="burn-line">
        {children}
      </div>
      <div aria-hidden data-nosnippet className="burn-line burn-core">
        {children}
      </div>
    </div>
  )
}
