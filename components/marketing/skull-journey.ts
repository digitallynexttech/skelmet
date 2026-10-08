import DOCKS from "@/components/marketing/skull-docks.json"

/**
 * The hero skull's route down the page, a pure function of scroll: from home
 * (the hero stage) it flies between and sits on the docks (`data-skull-dock`
 * photos, see SkullDock). No state between frames. Document px throughout: the
 * flying box is absolute, not fixed, so a docked skull scrolls natively.
 */

/**
 * Where the silhouette falls in its box: height as a share of box height, centre
 * as shares of width and height. Docks match the silhouette, not the bounding
 * box, since perspective makes the jaw project larger. REST_SILHOUETTE faces the
 * camera, for before the model loads; scripts/build-skull-model.mjs prints it.
 */
export type Silhouette = { height: number; centreX: number; centreY: number }
export const REST_SILHOUETTE: Silhouette = { height: 0.829, centreX: 0.5, centreY: 0.512 }

/** The skull's centre lands when it reaches this share of the viewport height... */
const ARRIVE = 0.58
/** ...and takes off again when it rises past this one. */
const LEAVE = 0.32
/** Shortest scroll a flight is allowed, so two close anchors still read as a trip. */
const MIN_FLIGHT = 240
/** Scroll, at each end of a flight, over which the skull eases from riding with the page. */
const RAMP = 280
/** How far a flight bows toward the middle of the viewport, as a share of the way there. */
const SWING = 0.7
/** How much smaller the skull gets mid-flight, as if pulled back in depth. */
const DIP = 0.14
/**
 * Nod toward the camera once seated, radians (18°): the photos were shot from
 * above eye level, so the seated skull tips forward to match. Eased in with `docked`.
 */
const DOCK_PITCH = 0.31

/** Below Tailwind's `sm`, the route ends at the docks marked `phone` (see SkullDock). */
const PHONE = "(width < 40rem)"

type Dock = { plate: string; width: number; height: number; skull: number[] }
const docks = DOCKS as Record<string, Dock>

export type Box = { left: number; top: number; right: number; bottom: number }

export type Anchor = {
  el: HTMLElement
  /** The hero stage: the skull bobs here, and nothing is clipped. */
  home: boolean
  /** How far the photographed skull is turned from facing the camera, radians. */
  turn: number
  /** The photo's own skull stays hidden for the whole route, not just the landing. */
  hideOwn: boolean
  /** The photographed skull's centre and height, document px. */
  cx: number
  cy: number
  h: number
  /** The photo's box, which crops a docked skull as it crops the photo. */
  clip: Box | null
}

export type Pose = {
  /** Skull centre and height, document px. */
  cx: number
  cy: number
  h: number
  /** Idle bob, 0..1. Off at a photo, so the skull stays seated on its bracket. */
  bob: number
  /** Extra yaw on top of the follow and drag, radians: the flight's turn. */
  spin: number
  /** The dock's own yaw, eased between stops. Unlike spin, it sets the silhouette. */
  turn: number
  /** Nod toward the camera while seated, radians: DOCK_PITCH by how seated. */
  pitch: number
  /** The crop to apply, document px, or null for none. */
  clip: Box | null
  /** How far each photo's own skull should be hidden, 0..1. */
  plates: Map<HTMLElement, number>
  /** How seated in the nearest photo, 0 in the hero or mid-flight to 1; drives the lighting. */
  docked: number
}

/** Every anchor on the page in document px, top to bottom. `rest` fits home to the hero stage. */
export function measureAnchors(rest: Silhouette = REST_SILHOUETTE): Anchor[] {
  const anchors: Anchor[] = []
  // On a phone, only the docks marked for it are stops.
  const docksOnRoute = window.matchMedia(PHONE).matches
    ? "[data-skull-dock][data-skull-phone]"
    : "[data-skull-dock]"
  const els = document.querySelectorAll<HTMLElement>(`[data-skull-home], ${docksOnRoute}`)

  for (const el of els) {
    const rect = el.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) continue
    const left = rect.left + window.scrollX
    const top = rect.top + window.scrollY

    if (el.hasAttribute("data-skull-home")) {
      anchors.push({
        el,
        home: true,
        turn: 0,
        hideOwn: false,
        cx: left + rect.width * rest.centreX,
        cy: top + rect.height * rest.centreY,
        h: rect.height * rest.height,
        clip: null,
      })
      continue
    }

    const dock = docks[el.dataset.skullDock ?? ""]
    if (!dock) continue
    // The photo is `object-cover`, centred; the skull box (source px) is mapped the same way.
    const scale = Math.max(rect.width / dock.width, rect.height / dock.height)
    const offsetX = (rect.width - dock.width * scale) / 2
    const offsetY = (rect.height - dock.height * scale) / 2
    const [x0 = 0, y0 = 0, x1 = 0, y1 = 0] = dock.skull
    anchors.push({
      el,
      home: false,
      turn: Number(el.dataset.skullTurn) || 0,
      hideOwn: el.hasAttribute("data-skull-hide-own"),
      cx: left + offsetX + ((x0 + x1) / 2) * scale,
      cy: top + offsetY + ((y0 + y1) / 2) * scale,
      h: (y1 - y0) * scale,
      clip: { left, top, right: left + rect.width, bottom: top + rect.height },
    })
  }

  anchors.sort((a, b) => a.cy - b.cy)
  // The route starts at home; a dock above the hero has nowhere to fly from.
  const start = anchors.findIndex((a) => a.home)
  return start < 0 ? [] : anchors.slice(start)
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const smootherstep = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)
const smoothstep = (lo: number, hi: number, v: number) => {
  const t = clamp01((v - lo) / (hi - lo))
  return t * t * (3 - 2 * t)
}

/**
 * Linear in the middle with rounded ends of width `r`: zero slope at the ends,
 * so the skull leaves and joins a dock moving with the page, while the straight
 * middle keeps a long flight in view (a full ease would carry it off screen).
 */
function ramp(t: number, r: number) {
  const v = 1 / (1 - r)
  if (t < r) return (v * t * t) / (2 * r)
  if (t > 1 - r) return 1 - (v * (1 - t) * (1 - t)) / (2 * r)
  return v * (r / 2 + t - r)
}

/** 1 when on a photo's skull. Drives plate and crop, so the swap happens while they overlap. */
function proximity(cx: number, cy: number, anchor: Anchor) {
  const distance = Math.hypot(cx - anchor.cx, cy - anchor.cy) / anchor.h
  return 1 - smoothstep(0.12, 0.8, distance)
}

/** Where the skull is at this scroll position. */
export function journey(anchors: Anchor[], scroll: number, vw: number, vh: number): Pose | null {
  const home = anchors[0]
  if (!home) return null

  // Scroll at which the skull lands on and leaves each anchor; it leaves home at 0.
  const arrive: number[] = [-Infinity]
  const leave: number[] = [0]
  for (let k = 1; k < anchors.length; k++) {
    const a = anchors[k]!
    const land = Math.max(a.cy - ARRIVE * vh, leave[k - 1]! + MIN_FLIGHT)
    arrive.push(land)
    leave.push(k === anchors.length - 1 ? Infinity : Math.max(land, a.cy - LEAVE * vh))
  }

  let cx = home.cx
  let cy = home.cy
  let h = home.h
  let bob = 1
  let spin = 0
  let turn = 0

  let k = 0
  while (k < anchors.length - 1 && scroll > leave[k]!) k++

  if (scroll >= arrive[k]!) {
    // Docked: glued to the anchor in the document.
    const a = anchors[k]!
    cx = a.cx
    cy = a.cy
    h = a.h
    bob = a.home ? 1 : 0
    turn = a.turn
  } else {
    const a = anchors[k - 1]!
    const b = anchors[k]!
    const span = arrive[k]! - leave[k - 1]!
    const t = clamp01((scroll - leave[k - 1]!) / span)
    const glide = smootherstep(t)
    const float = ramp(t, Math.min(0.45, RAMP / span))

    // Vertical is eased in viewport space, so the ramp's middle holds the skull steady on screen.
    const ay = a.cy - scroll
    const by = b.cy - scroll
    cy = lerp(ay, by, float) + scroll

    const mid = (a.cx + b.cx) / 2
    const bow = Math.sin(Math.PI * t)
    cx = lerp(a.cx, b.cx, glide) + bow * (vw / 2 - mid) * SWING
    h = lerp(a.h, b.h, glide) * (1 - DIP * bow)
    bob = Math.max(lerp(a.home ? 1 : 0, b.home ? 1 : 0, glide), bow)
    // One full turn (2π) in the direction of travel, so it lands facing as it left.
    spin = (b.cx >= a.cx ? 1 : -1) * Math.PI * 2 * glide
    turn = lerp(a.turn, b.turn, glide)
  }

  const plates = new Map<HTMLElement, number>()
  let clip: Box | null = null
  let nearest = 0
  for (const a of anchors) {
    if (a.home || !a.clip) continue
    const w = proximity(cx, cy, a)
    plates.set(a.el, a.hideOwn ? 1 : w)
    if (w > nearest) {
      nearest = w
      // Loosened as the skull leaves, so the crop never slices it mid-air.
      const slack = (1 - w) * vh
      clip = {
        left: a.clip.left - slack,
        top: a.clip.top - slack,
        right: a.clip.right + slack,
        bottom: a.clip.bottom + slack,
      }
    }
  }

  return { cx, cy, h, bob, spin, turn, pitch: DOCK_PITCH * nearest, clip, plates, docked: nearest }
}
