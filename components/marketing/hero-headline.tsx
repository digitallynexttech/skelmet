"use client"

import { useEffect, useRef, type ReactNode } from "react"

import { getSkullInteraction } from "@/components/marketing/skull-interaction"
import { cn } from "@/lib/utils"

/**
 * The hero line, burnt through where the skull meets it.
 *
 * The same words are painted four times, stacked (the layers live in
 * globals.css under `.burn`): solid paint, a blaze heat band, a hairline
 * outline, and a hot outline core. Each is masked by one ellipse centred on the
 * skull, so near the skull the paint is gone and only the outline is left; a
 * little further out the paint comes back through the heat, as a gradient;
 * past the halo the line is solid, exactly as it was.
 *
 * The ellipse follows the skull. The render loop in skull-canvas projects the
 * skull's pose into `halo` every frame, and this turns that into mask
 * coordinates — so turning the skull sweeps the burn across the letters it
 * faces, turning it to profile widens it, and flinging it flares it. On the
 * poster path nothing writes the halo, and the burn simply rests on the skull.
 *
 * The frame is this element's parent, which SkullStage fills edge to edge:
 * the halo is measured against the canvas, so the headline has to be rendered
 * as its sibling inside the same box.
 *
 * Only the first copy is the heading. The other three are aria-hidden and
 * outside the h1, so the heading's text — what a screen reader announces and a
 * crawler indexes — is still the line once.
 */

/**
 * How far out from the skull's centre the burn reaches, along the middle of
 * the line: a share of the skull's projected half-width plus a distance in
 * headline heights. Inside HOLLOW there is only outline; outside SOLID there is
 * only paint.
 *
 * The headline-height term is what keeps the burn about a letter either side
 * of the skull at every size. On a phone the skull is half the line wide, and a
 * burn scaled to the skull alone hollowed out every letter in it. Fitted to
 * put the edges on the same letters at 1536 and 390 wide.
 */
const HOLLOW = { skull: 0.69, line: 0.72 }
const SOLID = { skull: 0.69, line: 1.64 }
/**
 * Height of the halo against its width. Above 1, so the boundary bends round
 * the dome instead of cutting a circle through the letters.
 */
const HALO_ASPECT = 1.6
/** Smallest change, in percent of the headline box, worth a style write. */
const EPSILON = 0.02

export function HeroHeadline({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    const frame = el?.parentElement
    if (!el || !frame) return

    // Headline box relative to the frame, in screen pixels — after the
    // headline's own translate and scale, which the mask percentages are
    // blind to. A percentage of the transformed box is the same percentage of
    // the untransformed one, since both axes scale independently.
    const box = { left: 0, top: 0, width: 1, height: 1, frameWidth: 1, frameHeight: 1 }
    const last = { x: NaN, y: NaN, rx: NaN, ry: NaN, inner: NaN }

    const measure = () => {
      const a = el.getBoundingClientRect()
      const b = frame.getBoundingClientRect()
      if (a.width === 0 || a.height === 0) return
      box.left = a.left - b.left
      box.top = a.top - b.top
      box.width = a.width
      box.height = a.height
      box.frameWidth = b.width
      box.frameHeight = b.height
      // Geometry moved under the last write, so the next frame must write
      // even if the halo itself has not.
      last.x = NaN
    }

    const write = () => {
      const { halo } = getSkullInteraction()
      const skull = halo.r * box.frameHeight
      const centreX = halo.x * box.frameWidth - box.left
      const centreY = halo.y * box.frameHeight - box.top
      // A spinning skull throws its heat further.
      const reach = 1 + halo.flare
      const hollow = (HOLLOW.skull * skull + HOLLOW.line * box.height) * reach
      const solid = (SOLID.skull * skull + SOLID.line * box.height) * reach

      // The halo is centred on the skull, which can sit well below the line —
      // on a phone the type only grazes the top of the dome. Size the ellipse
      // so its stops still cross the middle of the line at `hollow` and
      // `solid`, rather than losing that distance to the vertical offset.
      const offset = (centreY - box.height / 2) / HALO_ASPECT
      const outer = Math.hypot(solid, offset)
      const inner = (Math.hypot(hollow, offset) / outer) * 100

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

    // The line's width depends on the display face, which may still be
    // swapping in when this mounts.
    let alive = true
    void document.fonts?.ready.then(() => {
      if (alive) measure()
    })

    const resize = new ResizeObserver(measure)
    resize.observe(el)
    resize.observe(frame)
    // Crossing xl changes the headline's scale, which a ResizeObserver does
    // not see on its own.
    window.addEventListener("resize", measure)

    // Only follow the skull while it can be seen.
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
