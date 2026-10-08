import { Euler, PerspectiveCamera, Vector3 } from "three"
import { describe, expect, it } from "vitest"

import {
  BLEED,
  BLEED_FOV,
  CAMERA_Z,
  haloPointOf,
  OPTICAL_CENTRE_LIFT,
  silhouetteOf,
  STAGE_FOV,
  VIEW_HEIGHT,
} from "@/components/marketing/skull-optics"

// Holds skull-optics to three.js: if they part, the burn and the docks miss the skull.

/** The scene's camera, as skull-scene builds it, for a box of this aspect. */
function sceneCamera(aspect: number) {
  const camera = new PerspectiveCamera(BLEED_FOV, (aspect * BLEED.x) / BLEED.y, 0.1, 1000)
  camera.position.set(0, 0, CAMERA_Z)
  camera.updateMatrixWorld(true)
  camera.updateProjectionMatrix()
  return camera
}

/** A pivot-space point, turned and lifted as the pivot is, through that camera: box shares. */
function throughThree(point: Vector3, rotation: Euler, aspect: number) {
  const p = point.clone().applyEuler(rotation)
  p.y += OPTICAL_CENTRE_LIFT
  p.project(sceneCamera(aspect))
  return { x: (p.x * BLEED.x + 1) / 2, y: (1 - p.y * BLEED.y) / 2 }
}

describe("the skull's optics, against three.js", () => {
  it("sees 3.097 units top to bottom at the pivot", () => {
    expect(VIEW_HEIGHT).toBeCloseTo(3.097, 3)
    expect(STAGE_FOV).toBe(32)
  })

  it("puts the headline's burn point where the scene's camera does, at any turn", () => {
    const poses: [number, number, number][] = [
      [0, 0, 0],
      [0.3, 0, 0],
      [0, 0.55, 0],
      [-0.2, -0.4, 0.15],
      [0.31, 1.2, -0.3],
      [0.1, Math.PI * 1.5, 0.05],
    ]
    for (const aspect of [0.8, 0.62, 1]) {
      for (const [x, y, z] of poses) {
        const ours = haloPointOf(x, y, z, aspect)
        const theirs = throughThree(new Vector3(0, 0.45, 1.1), new Euler(x, y, z), aspect)
        expect(ours.x, `x at ${x},${y},${z}`).toBeCloseTo(theirs.x, 6)
        expect(ours.y, `y at ${x},${y},${z}`).toBeCloseTo(theirs.y, 6)
      }
    }
  })

  it("measures an outline as the extremes of the points through that camera", () => {
    // A box of points about the pivot, deeper than it is wide, as the print is.
    const corners: number[] = []
    for (const x of [-0.8, 0.8])
      for (const y of [-1.1, 1.18]) for (const z of [-1.2, 0.9]) corners.push(x, y, z)
    const surface = Float32Array.from(corners)
    const aspect = 0.8

    for (const [turn, pitch] of [
      [0, 0],
      [0.5, 0],
      [0, 0.31],
      [-0.9, 0.2],
    ] as const) {
      let minX = Infinity
      let maxX = -Infinity
      let minY = Infinity
      let maxY = -Infinity
      for (let k = 0; k < surface.length; k += 3) {
        // rotation.x then rotation.y, as one XYZ Euler: yaw applied first.
        const at = throughThree(
          new Vector3(surface[k], surface[k + 1], surface[k + 2]),
          new Euler(pitch, turn, 0),
          aspect,
        )
        minX = Math.min(minX, at.x)
        maxX = Math.max(maxX, at.x)
        minY = Math.min(minY, at.y)
        maxY = Math.max(maxY, at.y)
      }
      const outline = silhouetteOf(surface, aspect, turn, pitch)
      expect(outline.height, `height at ${turn},${pitch}`).toBeCloseTo(maxY - minY, 6)
      expect(outline.centreX, `centre x at ${turn},${pitch}`).toBeCloseTo((minX + maxX) / 2, 6)
      expect(outline.centreY, `centre y at ${turn},${pitch}`).toBeCloseTo((minY + maxY) / 2, 6)
    }
  })
})
