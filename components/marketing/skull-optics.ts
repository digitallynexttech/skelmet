import type { Silhouette } from "@/components/marketing/skull-journey"

/**
 * How the hero skull is framed, as numbers and plain arithmetic.
 *
 * Two places need it and they are on different threads. The scene
 * (skull-scene) draws through this camera, off the main thread where the
 * browser allows. The page (skull-canvas) has to know where that drawing
 * lands - to seat the skull on a photograph, to burn the headline round it -
 * without asking the scene every frame, and without loading three.js to do
 * a projection. So the camera lives here, with no imports, and both read it.
 */

/** The camera that frames the stage: 32° tall, from z = 5.4, looking down -z. */
export const STAGE_FOV = 32
export const CAMERA_Z = 5.4

const TAN = Math.tan((STAGE_FOV * Math.PI) / 360)

/** World units the stage shows top to bottom at the pivot's depth: 3.096. */
export const VIEW_HEIGHT = 2 * CAMERA_Z * TAN

/**
 * Perspective throws the chin, which is nearer the camera, further from centre
 * than it does the cranium, so a model centred on its bounding box renders low
 * enough that the idle bob clips it against the bottom of the canvas. Only
 * enough lift to clear that: the space above the cranium is not waste, it is
 * where the headline sits, and optically centring the skull put the solid dome
 * level with the type and swallowed three letters.
 */
export const OPTICAL_CENTRE_LIFT = 0.06

/**
 * How tall the skull stands, in the 3.096 units the stage shows: on screen
 * about 84% of the stage, the jaw being nearer the camera than the crown.
 * The size it had before it was tilted to meet the eye; sized to the full
 * 2.5 it crowded the headline. scripts/build-skull-model.mjs holds the same
 * number, for the silhouette figures it prints.
 */
export const SKULL_HEIGHT = 2.36

/**
 * The canvas is drawn larger than the stage, by this much each way, centred
 * on it. The print is deeper than it is tall, so turned side-on it reaches
 * 1.43 of the stage's half-width, and pitched down its jaw reaches 1.23 of
 * the half-height - past a canvas the stage's size, which cut it off. The
 * camera opens by the same factors, so the stage region of the canvas is
 * drawn exactly as the stage camera would draw it, and the extra is room.
 */
export const BLEED = { x: 1.5, y: 1.3 }

/** The bled camera's vertical field of view, degrees. */
export const BLEED_FOV = (2 * Math.atan(BLEED.y * TAN) * 180) / Math.PI

/**
 * The point the headline burns around, in pivot space: up on the cranium,
 * where the dome crosses the type, and pushed out in front of the face. The
 * forward push is what makes the burn follow the gaze - turn the skull and the
 * point swings out to that side, so the letters it faces go hollow first.
 * HALO_REST in skull-interaction is this point projected at rest; change one
 * and recompute the other.
 */
const HALO_CROWN = 0.45
const HALO_REACH = 1.1

/**
 * Where the mesh's outline falls in its box, turned `turn` and nodded `pitch`
 * (radians): its height as a share of the box height, and its middle as
 * shares of the box width and height.
 *
 * `surface` is points on the model in pivot space, x y z in turn. The outline
 * is their extremes through the stage camera - not the bled one: the shares
 * are of the box.
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
    // Yaw then pitch about the pivot, as three applies rotation.y and
    // rotation.x, the pivot's lift, then the perspective divide. Out in
    // NDC, where the box spans -1..1.
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
 * Where the burn point lands in the box for a skull rotated (x, y, z), as
 * shares of the box from its top left. three's own order: rotation.x, then
 * y, then z, as one XYZ Euler. The bob is left out on purpose - it never
 * settles, and following it would repaint four layers of display type every
 * frame for a drift nobody would read as a response.
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
  // The second and third columns of the XYZ rotation matrix, applied to
  // (0, HALO_CROWN, HALO_REACH).
  const x = -c * f * HALO_CROWN + d * HALO_REACH
  const y = (a * e - b * f * d) * HALO_CROWN - b * c * HALO_REACH + OPTICAL_CENTRE_LIFT
  const z = (b * e + a * f * d) * HALO_CROWN + a * c * HALO_REACH
  const depth = (CAMERA_Z - z) * TAN
  return { x: (x / (depth * aspect) + 1) / 2, y: (1 - y / depth) / 2 }
}

/**
 * The skull's projected half-width as a share of the box height, turned to
 * `yaw`. The skull is deeper than it is wide, so its silhouette broadens as it
 * turns toward profile - and the burn broadens with it. Projected as an
 * ellipse, which a cranium is close to; the bounding box's own width swells
 * half as much again at 45° and burnt the whole line away.
 */
export function haloRadiusOf(yaw: number, width: number, depth: number): number {
  return Math.hypot(Math.cos(yaw) * width, Math.sin(yaw) * depth) / 2 / VIEW_HEIGHT
}
