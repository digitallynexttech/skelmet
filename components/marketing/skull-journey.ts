import DOCKS from "@/components/marketing/skull-docks.json"

/**
 * The hero skull's route down the page, as a pure function of scroll.
 *
 * The skull has a home - the hero stage - and a run of docks further down:
 * photographs of the skull, each marked with `data-skull-dock` by SkullDock.
 * Docked, the mesh sits exactly over the photographed skull, at its size, and
 * moves with the page as if it were part of the picture. Between two stops it
 * flies: it lifts off, floats alongside the reader, turns once, and lands on
 * the next one as that scrolls into place.
 *
 * Everything is derived from the scroll position and the measured anchors,
 * with no state carried between frames, so scrolling back up simply runs the
 * route in reverse and a reload mid-page puts the skull wherever that point on
 * the route is.
 *
 * Coordinates are document pixels throughout, because the flying element is
 * positioned in the document rather than fixed to the viewport. That is what
 * lets a docked skull scroll with its photo natively - a fixed element moved
 * from requestAnimationFrame trails threaded scrolling by a frame, and a skull
 * sliding against the bracket it is supposed to be sitting on is the one
 * artefact this cannot afford.
 */

/**
 * Where the mesh's silhouette falls in its canvas box: its height as a share
 * of the box height, and its middle as shares of the box width and height.
 * Every dock is matched against the silhouette, not the model's box, because
 * perspective makes the two differ - the jaw is nearer the camera than the
 * crown, so it projects larger and lower. Sized from the bounding box (0.807
 * tall, lifted 1.9%), a docked skull came out a tenth oversize.
 *
 * skull-canvas measures the silhouette off the model's own vertices, at
 * whatever angle a dock turns it to. REST_SILHOUETTE is that measurement
 * facing the camera, for the frames before the model has loaded.
 */
export type Silhouette = { height: number; centreX: number; centreY: number }
export const REST_SILHOUETTE: Silhouette = { height: 0.893, centreX: 0.5, centreY: 0.513 }

/** The skull's centre lands when it reaches this share of the viewport height... */
const ARRIVE = 0.58
/** ...and takes off again when it rises past this one. */
const LEAVE = 0.32
/** Shortest scroll a flight is allowed, so two close anchors still read as a trip. */
const MIN_FLIGHT = 240
/**
 * Scroll over which the skull eases between riding with the page and floating
 * free of it, at each end of a flight. Without it the skull would stop dead
 * against the scroll the instant it left a dock.
 */
const RAMP = 280
/** How far a flight bows toward the middle of the viewport, as a share of the way there. */
const SWING = 0.7
/** How much smaller the skull gets mid-flight, as if pulled back in depth. */
const DIP = 0.14

/**
 * Phones, as Tailwind's `sm` breakpoint draws the line. Here the route is cut
 * short: the skull flies from the hero to the docks marked `phone` (see
 * SkullDock) and stays there, rather than following the reader down a page
 * that is several screens longer on a phone than on a desktop.
 */
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
  /** The photo's box - a docked skull is cropped by it, as the photo is. */
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
  /** The crop to apply, document px, or null for none. */
  clip: Box | null
  /** How far each photo's own skull should be hidden, 0..1. */
  plates: Map<HTMLElement, number>
}

/**
 * Read every anchor on the page into document coordinates, top to bottom.
 * `rest` is where the silhouette sits facing the camera, which is what puts
 * the flying box exactly over the hero stage when the skull is home.
 */
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
    // The photo is `object-cover`, centred: scale to fill, crop the overflow
    // evenly. The skull box is in source pixels, so it goes through the same.
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
 * Linear through the middle, with rounded ends of width `r`. Used for the
 * vertical path: zero slope at both ends means the skull leaves and joins a
 * dock moving exactly with the page, and the straight middle keeps it
 * floating in view however long the flight - a full ease would carry a long
 * flight off the top of the screen and back.
 */
function ramp(t: number, r: number) {
  const v = 1 / (1 - r)
  if (t < r) return (v * t * t) / (2 * r)
  if (t > 1 - r) return 1 - (v * (1 - t) * (1 - t)) / (2 * r)
  return v * (r / 2 + t - r)
}

/**
 * How close the skull is to a photo's skull, 1 when on it. Drives both the
 * plate that hides the photographed skull and the crop, so the swap happens
 * exactly while the two overlap and either can cover for the other.
 */
function proximity(cx: number, cy: number, anchor: Anchor) {
  const distance = Math.hypot(cx - anchor.cx, cy - anchor.cy) / anchor.h
  return 1 - smoothstep(0.12, 0.8, distance)
}

/** Where the skull is at this scroll position. */
export function journey(anchors: Anchor[], scroll: number, vw: number, vh: number): Pose | null {
  const home = anchors[0]
  if (!home) return null

  // Scroll positions at which the skull lands on and leaves each anchor. Home
  // is where it starts, and it lifts off with the first pixel of scroll.
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

    // Vertical is interpolated in viewport space, where the ramp's straight
    // middle holds the skull steady on screen, then put back into the page.
    const ay = a.cy - scroll
    const by = b.cy - scroll
    cy = lerp(ay, by, float) + scroll

    const mid = (a.cx + b.cx) / 2
    const bow = Math.sin(Math.PI * t)
    cx = lerp(a.cx, b.cx, glide) + bow * (vw / 2 - mid) * SWING
    h = lerp(a.h, b.h, glide) * (1 - DIP * bow)
    bob = Math.max(lerp(a.home ? 1 : 0, b.home ? 1 : 0, glide), bow)
    // One full turn, in the direction of travel. A multiple of 2π, so it
    // lands facing exactly the way it left.
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
      // Relaxed away from the photo's edges as the skull leaves, so the crop
      // never slices it mid-air.
      const slack = (1 - w) * vh
      clip = {
        left: a.clip.left - slack,
        top: a.clip.top - slack,
        right: a.clip.right + slack,
        bottom: a.clip.bottom + slack,
      }
    }
  }

  return { cx, cy, h, bob, spin, turn, clip, plates }
}
