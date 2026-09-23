/**
 * Mutable interaction state for the hero skull, deliberately kept outside React.
 *
 * Pointer moves and drags update this object every animation frame. Routing
 * that through props or state would either re-render the tree 60 times a second
 * or trip the compiler's "don't mutate props after render" rule, so the DOM
 * handlers in `skull-stage`, the render loop in `skull-canvas` and the headline
 * in `hero-headline` all reach for this module-level instance instead.
 *
 * Single instance by design: there is one hero skull per page.
 */
export type SkullInteraction = {
  /** Cursor position normalised to -1..1 across the viewport. */
  pointer: { x: number; y: number }
  /** Free-spin offset accumulated while dragging; decays back to zero. */
  userRot: { x: number; y: number }
  /** Angular velocity carried out of a drag, for release momentum. */
  vel: { x: number; y: number }
  dragging: boolean
  /**
   * Where the skull's heat lands on screen, written by the render loop and
   * read by the headline. The centre is a fraction of the canvas box (0..1,
   * top-left origin); the radius is the skull's projected half-width as a
   * fraction of the canvas height, so it means the same thing at any aspect.
   * Flare is how hard the skull is spinning, 0 at rest.
   */
  halo: { x: number; y: number; r: number; flare: number }
}

/**
 * The halo at rest, facing the camera. The poster path never loads the canvas,
 * so nothing ever overwrites this — it has to be where the mesh would put it,
 * or the burn would sit off the skull for every visitor on the fallback.
 *
 * Derived from skull-canvas: the crown anchor (0, 0.45, 1.1) lifted by
 * OPTICAL_CENTRE_LIFT projects to y = 0.293 through the z=5.4, 32° camera; the
 * model is 0.638 as wide as it is tall, so at 2.5 units high its half-width is
 * 0.797 of the 3.096 units the camera sees.
 */
export const HALO_REST = { x: 0.5, y: 0.293, r: 0.257, flare: 0 } as const

const interaction: SkullInteraction = {
  pointer: { x: 0, y: 0 },
  userRot: { x: 0, y: 0 },
  vel: { x: 0, y: 0 },
  dragging: false,
  halo: { ...HALO_REST },
}

export function getSkullInteraction(): SkullInteraction {
  return interaction
}
