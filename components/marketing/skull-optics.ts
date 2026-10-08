import type { Silhouette } from "@/components/marketing/skull-journey"

/**
 * The hero camera as plain arithmetic, with no imports, so the scene (in a
 * worker) and the page (skull-canvas) share it without three.js on the main
 * thread. skull-optics.test.ts holds it to three.js.
 */

/** The camera that frames the stage: 32° tall, from z = 5.4, looking down -z. */
export const STAGE_FOV = 32
export const CAMERA_Z = 5.4

const TAN = Math.tan((STAGE_FOV * Math.PI) / 360)

/** World units the stage shows top to bottom at the pivot's depth: 3.096. */
export const VIEW_HEIGHT = 2 * CAMERA_Z * TAN

/**
 * World-unit lift so the idle bob does not clip the chin (perspective throws it
 * low). Kept small: the space above the cranium is where the headline sits.
 */
export const OPTICAL_CENTRE_LIFT = 0.06

/**
 * Skull height in world units (of VIEW_HEIGHT); larger crowds the headline.
 * scripts/build-skull-model.mjs holds the same number.
 */
export const SKULL_HEIGHT = 2.36

/**
 * The canvas is drawn larger than the stage by this much each way, centred, so
 * a turned or pitched skull is not cut off. The camera opens by the same factor,
 * so the stage region is drawn exactly as the stage camera would.
 */
export const BLEED = { x: 1.5, y: 1.3 }

/** The bled camera's vertical field of view, degrees. */
export const BLEED_FOV = (2 * Math.atan(BLEED.y * TAN) * 180) / Math.PI

/**
 * The point the headline burns around, in pivot space: up on the cranium and
 * pushed out in front of the face, so the burn follows the gaze. HALO_REST in
 * skull-interaction is this projected at rest; change one, recompute the other.
 */
const HALO_CROWN = 0.45
const HALO_REACH = 1.1

/**
 * Where the outline falls in its box (see Silhouette), turned `turn` and nodded
 * `pitch` (radians). `surface` is pivot-space points, x y z in turn. Projected
 * through the stage camera, not the bled one: the shares are of the box.
 */
export function silhouetteOf(
  surface: Float32Array,
  aspect: number,
  turn: number,
  pitch: number,
): Silhouette {
  const cos = Math.cos(turn)
  const sin = Math.sin(turn)
  const cosP = Math.cos(pitch)
  const sinP = Math.sin(pitch)
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (let k = 0; k < surface.length; k += 3) {
    const x = surface[k]!
    const y = surface[k + 1]!
    const z = surface[k + 2]!
    // Yaw then pitch (as three applies rotation.y, rotation.x), lift, then the
    // perspective divide into NDC (-1..1).
    const turnedX = x * cos + z * sin
    const turnedZ = -x * sin + z * cos
    const noddedY = y * cosP - turnedZ * sinP + OPTICAL_CENTRE_LIFT
    const noddedZ = y * sinP + turnedZ * cosP
    const depth = (CAMERA_Z - noddedZ) * TAN
    const nx = turnedX / (depth * aspect)
    const ny = noddedY / depth
    if (nx < minX) minX = nx
    if (nx > maxX) maxX = nx
    if (ny < minY) minY = ny
    if (ny > maxY) maxY = ny
  }
  return {
    height: (maxY - minY) / 2,
    centreX: (1 + (minX + maxX) / 2) / 2,
    centreY: (1 - (minY + maxY) / 2) / 2,
  }
}

/**
 * Where the burn point lands for rotation (x, y, z) as one XYZ Euler, in shares
 * of the box from its top left. The bob is left out: following it would repaint
 * the display type every frame.
 */
export function haloPointOf(
  rx: number,
  ry: number,
  rz: number,
  aspect: number,
): { x: number; y: number } {
  const a = Math.cos(rx)
  const b = Math.sin(rx)
  const c = Math.cos(ry)
  const d = Math.sin(ry)
  const e = Math.cos(rz)
  const f = Math.sin(rz)
  // Columns 2 and 3 of the XYZ rotation matrix, applied to (0, HALO_CROWN, HALO_REACH).
  const x = -c * f * HALO_CROWN + d * HALO_REACH
  const y = (a * e - b * f * d) * HALO_CROWN - b * c * HALO_REACH + OPTICAL_CENTRE_LIFT
  const z = (b * e + a * f * d) * HALO_CROWN + a * c * HALO_REACH
  const depth = (CAMERA_Z - z) * TAN
  return { x: (x / (depth * aspect) + 1) / 2, y: (1 - y / depth) / 2 }
}

/**
 * Projected half-width as a share of box height at `yaw`, treating the cranium
 * as an ellipse (the bounding box overshoots at an angle).
 */
export function haloRadiusOf(yaw: number, width: number, depth: number): number {
  return Math.hypot(Math.cos(yaw) * width, Math.sin(yaw) * depth) / 2 / VIEW_HEIGHT
}
