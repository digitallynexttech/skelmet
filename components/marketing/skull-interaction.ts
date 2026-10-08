import SKULL_ASSETS from "@/components/marketing/skull-assets.json"

/**
 * Per-frame interaction state for the hero skull, kept outside React on purpose:
 * props or state would re-render 60 times a second. One module-level instance,
 * shared by skull-stage, skull-canvas and hero-headline.
 */
export type SkullInteraction = {
  /** Last cursor position in the viewport, or null before the first move. */
  cursor: { x: number; y: number } | null
  /** Cursor relative to the skull, -1..1 over half the viewport; set by the render loop. */
  pointer: { x: number; y: number }
  /** Free-spin offset accumulated while dragging; decays back to zero. */
  userRot: { x: number; y: number }
  /** Angular velocity carried out of a drag, for release momentum. */
  vel: { x: number; y: number }
  dragging: boolean
  /**
   * Where the skull's heat lands, for the headline. x, y: fraction of the canvas
   * box (0..1, top-left origin); r: projected half-width as a fraction of box
   * height; flare: spin strength, 0 at rest.
   */
  halo: { x: number; y: number; r: number; flare: number }
  /** The canvas box in viewport px while the mesh is live; null on the poster path. */
  box: { x: number; y: number; w: number; h: number } | null
  /** The skull's silhouette on screen, as an ellipse, for grabbing it. Null when off screen. */
  hit: { x: number; y: number; rx: number; ry: number } | null
  /** The poster's bob animation start, performance.now() ms, so the mesh joins it mid-stride. */
  bobEpoch: number
}

/**
 * The idle bob, shared by mesh and poster (`skull-bob` keyframes) so the hand-off
 * is invisible. Period in seconds; rise as a share of stage height (world units
 * over the 3.096 the camera sees at the pivot).
 */
export const BOB_PERIOD = 11.4
export const BOB_RISE = 0.045 / 3.096

/**
 * Here, not in skull-canvas, so the stage can query the cache without three.js.
 * Content-hashed names from skull-assets.json (scripts/skull-assets.mjs):
 * /product is cached for a month, so a changed file needs a new name.
 */
export const SKULL_MODEL = SKULL_ASSETS.model
export const SKULL_POSTER = SKULL_ASSETS.poster

/**
 * A phone that keeps the poster: touch, with 2 GB or less or 4 cores or fewer.
 * Judged only where deviceMemory exists (Chromium): Safari says 4 cores on every
 * iPhone. Memory rounds to a power of two (6 GB reads 4), hence 2. Unreported means capable.
 */
export function strugglesWithModel(device: {
  /** `(pointer: coarse)`: a touch screen. */
  touch: boolean
  /** `navigator.deviceMemory`, in GB; undefined where the browser has none. */
  memory: number | undefined
  /** `navigator.hardwareConcurrency`. */
  cores: number | undefined
}): boolean {
  if (!device.touch || device.memory === undefined) return false
  return device.memory <= 2 || (device.cores !== undefined && device.cores <= 4)
}

/**
 * The halo at rest, facing the camera. The poster path never runs the canvas, so
 * this must match what the mesh would compute; scripts/build-skull-model.mjs
 * prints the radius for a new model.
 */
export const HALO_REST = { x: 0.5, y: 0.293, r: 0.283, flare: 0 } as const

const interaction: SkullInteraction = {
  cursor: null,
  pointer: { x: 0, y: 0 },
  userRot: { x: 0, y: 0 },
  vel: { x: 0, y: 0 },
  dragging: false,
  halo: { ...HALO_REST },
  box: null,
  hit: null,
  bobEpoch: 0,
}

export function getSkullInteraction(): SkullInteraction {
  return interaction
}
