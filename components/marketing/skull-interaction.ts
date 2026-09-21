/**
 * Mutable interaction state for the hero skull, deliberately kept outside React.
 *
 * Pointer moves and drags update this object every animation frame. Routing
 * that through props or state would either re-render the tree 60 times a second
 * or trip the compiler's "don't mutate props after render" rule, so the DOM
 * handlers in `skull-stage` and the render loop in `skull-canvas` both reach for
 * this module-level instance instead.
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
}

const interaction: SkullInteraction = {
  pointer: { x: 0, y: 0 },
  userRot: { x: 0, y: 0 },
  vel: { x: 0, y: 0 },
  dragging: false,
}

export function getSkullInteraction(): SkullInteraction {
  return interaction
}
