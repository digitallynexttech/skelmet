"use client"

import { Suspense, useEffect, useMemo, useRef } from "react"
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber"
import {
  ACESFilmicToneMapping,
  Box3,
  PCFSoftShadowMap,
  PMREMGenerator,
  Vector3,
  type Group,
  type Mesh,
  type MeshStandardMaterial,
} from "three"
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"

import { getSkullInteraction } from "@/components/marketing/skull-interaction"

/**
 * Final rotation = `follow` + `userRot`:
 *   follow  - eased toward wherever the cursor is, so the skull "looks at" you.
 *   userRot - free spin accumulated while dragging. It keeps its momentum on
 *             release, then decays back to zero, handing the skull back to the
 *             follow pose instead of leaving it stranded facing backwards.
 */

/** How far the look-at pose swings at the edges of the viewport (radians). */
const MAX_YAW = 0.55
const MAX_PITCH = 0.3
/** Per-second retention: lower = snappier. Used with delta for frame independence. */
const FOLLOW_SMOOTHING = 0.002
const SPIN_FRICTION = 0.94
const RETURN_FRICTION = 0.965

/**
 * Yaw applied once at load so the skull rests facing the viewer. Generators do
 * not agree on which way "forward" ends up, so this is measured against the
 * rendered result rather than assumed.
 */
const MODEL_YAW_OFFSET = 0

/**
 * Perspective throws the chin, which is nearer the camera, further from centre
 * than it does the cranium, so a model centred on its bounding box renders low
 * enough that the idle bob clips it against the bottom of the canvas. Only
 * enough lift to clear that: the space above the cranium is not waste, it is
 * where the headline sits, and optically centring the skull put the solid dome
 * level with the type and swallowed three letters.
 */
const OPTICAL_CENTRE_LIFT = 0.06

function SkullModel({ onReady }: { onReady: () => void }) {
  const gltf = useLoader(GLTFLoader, "/product/skull.glb")
  const groupRef = useRef<Group>(null)
  const follow = useRef({ x: 0, y: 0 })

  // Only mounts once useLoader has resolved, so this is the real "the mesh is
  // on screen" signal the poster cross-fade waits for.
  useEffect(() => {
    onReady()
  }, [onReady])

  const { object, offset, scale } = useMemo(() => {
    // Clone before touching anything: the gltf belongs to useLoader's cache,
    // so mutating it would leak across mounts and trip the immutability rule.
    const root = gltf.scene.clone(true)

    // Generators ship these meshes as metalness 1 / roughness 1. That is wrong
    // for matte PLA: a fully metallic surface takes its colour from
    // reflections rather than its own base map, which turns the orange into
    // washed-out grey plastic. Retag it as the dielectric it actually is.
    root.traverse((child) => {
      const mesh = child as Mesh
      if (!mesh.isMesh) return
      const source = mesh.material as MeshStandardMaterial
      const material = source.clone()
      material.metalness = 0.0
      // The generator's roughness map is dropped rather than scaled: three
      // multiplies `roughness` by the map, so a glossy map keeps blown-out
      // hotspots no matter how high the scalar goes. A uniform value gives one
      // broad, controllable sheen instead. Not fully diffuse, though - at 1.0
      // the surface loses every specular cue and reads as moulded toy plastic.
      // The normal map stays: that is where the flame relief and layer lines
      // live.
      material.roughnessMap = null
      material.roughness = 0.58
      material.envMapIntensity = 0.3

      // Self-shadowing is what carves the eye sockets and the flame grooves.
      // Without it the form is only shaded by lambert falloff, which is flat.
      mesh.castShadow = true
      mesh.receiveShadow = true
      mesh.material = material
    })

    const box = new Box3().setFromObject(root)
    const size = box.getSize(new Vector3())
    const centre = box.getCenter(new Vector3())
    const longest = Math.max(size.x, size.y, size.z) || 1
    // Normalised so the longest axis fills most of the frame. Kept under the
    // full 3.1-unit view height so a dragged skull, which is deeper than it is
    // wide, cannot clip the edges mid-spin.
    return { object: root, offset: centre, scale: 2.5 / longest }
  }, [gltf])

  useFrame((state, delta) => {
    const group = groupRef.current
    if (!group) return
    const i = getSkullInteraction()

    // Clamp delta so a backgrounded tab doesn't resume with one huge jump.
    const d = Math.min(delta, 0.05)

    if (!i.dragging) {
      i.userRot.x += i.vel.x
      i.userRot.y += i.vel.y
      i.vel.x *= SPIN_FRICTION
      i.vel.y *= SPIN_FRICTION
      i.userRot.x *= RETURN_FRICTION
      i.userRot.y *= RETURN_FRICTION
    }

    const t = 1 - Math.pow(FOLLOW_SMOOTHING, d)
    // Positive rotation.x tips the face downward, and pointer.y is positive
    // toward the bottom of the screen - so they share a sign. Negating it here
    // made the skull look up as the cursor went down.
    follow.current.x += (i.pointer.y * MAX_PITCH - follow.current.x) * t
    follow.current.y += (i.pointer.x * MAX_YAW - follow.current.y) * t

    group.rotation.x = follow.current.x + i.userRot.x
    group.rotation.y = MODEL_YAW_OFFSET + follow.current.y + i.userRot.y
    group.position.y = OPTICAL_CENTRE_LIFT + Math.sin(state.clock.elapsedTime * 0.55) * 0.045
  })

  return (
    <group ref={groupRef}>
      <group scale={scale}>
        <primitive object={object} position={[-offset.x, -offset.y, -offset.z]} />
      </group>
    </group>
  )
}

/**
 * Procedural image-based lighting. `RoomEnvironment` is generated in-process,
 * so the PBR materials get soft directional response with no HDRI download.
 */
function StudioEnvironment() {
  const gl = useThree((s) => s.gl)

  const texture = useMemo(() => {
    const pmrem = new PMREMGenerator(gl)
    const generated = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    pmrem.dispose()
    return generated
  }, [gl])

  useEffect(() => () => texture.dispose(), [texture])

  // `attach` writes to the parent - the scene, for a direct Canvas child - so
  // R3F owns the mutation and undoes it on unmount.
  return <primitive attach="environment" object={texture} />
}

export function SkullCanvas({ active, onReady }: { active: boolean; onReady: () => void }) {
  return (
    <Canvas
      shadows={{ type: PCFSoftShadowMap }}
      // Pause the loop entirely when the hero is scrolled out of view.
      frameloop={active ? "always" : "never"}
      dpr={[1, 1.75]}
      camera={{ position: [0, 0, 5.4], fov: 32 }}
      gl={{
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
        toneMapping: ACESFilmicToneMapping,
        toneMappingExposure: 1.08,
      }}
      // The procedural room is for soft shading only; at full strength it
      // washes the orange toward cream.
      scene={{ environmentIntensity: 0.14 }}
    >
      <StudioEnvironment />

      {/* Hard key, high and to the left, as in the product photography. It
          is the only shadow caster: one decisive light source is what gives
          the skull its contrast. */}
      <directionalLight
        castShadow
        position={[-3.4, 4.4, 1.9]}
        intensity={5.6}
        color="#ffeedd"
        shadow-mapSize={[2048, 2048]}
        // Bias pair tuned for a double-sided mesh: without normalBias the
        // curved cranium stipples itself with shadow acne.
        shadow-bias={-0.0006}
        shadow-normalBias={0.025}
        shadow-camera-near={0.1}
        shadow-camera-far={14}
        shadow-camera-left={-2.4}
        shadow-camera-right={2.4}
        shadow-camera-top={2.4}
        shadow-camera-bottom={-2.4}
      />
      {/* Hot blaze kicker raking the right edge, so the silhouette stays lit
          against a black page even when the face turns away. */}
      <pointLight position={[3.6, 0.5, -1.2]} intensity={85} distance={22} color="#ff5a1f" />
      {/* Cool counter-rim on the opposite edge, separating skull from ground. */}
      <pointLight position={[-3.4, 1.6, -2.4]} intensity={45} distance={22} color="#7c5cff" />
      {/* Weak warm bounce under the jaw, so the teeth do not fall to black. */}
      <pointLight position={[0.4, -2.8, 2.2]} intensity={9} distance={14} color="#ff8a4a" />
      {/* Dim, cool bounce so the shadow side keeps detail without going grey.
          Ambient is the single biggest cause of a flat, plastic-toy look. */}
      <ambientLight intensity={0.07} color="#3a3a52" />

      <Suspense fallback={null}>
        <SkullModel onReady={onReady} />
      </Suspense>
    </Canvas>
  )
}

export default SkullCanvas
