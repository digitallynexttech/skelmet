"use client"

import { useEffect, useRef } from "react"
import {
  ACESFilmicToneMapping,
  AmbientLight,
  Box3,
  DirectionalLight,
  Group,
  PCFShadowMap,
  PerspectiveCamera,
  PMREMGenerator,
  PointLight,
  Scene,
  Timer,
  Vector3,
  WebGLRenderer,
  type Mesh,
  type MeshStandardMaterial,
} from "three"
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"

import { getSkullInteraction } from "@/components/marketing/skull-interaction"

/**
 * The hero mesh, driven directly against three.js.
 *
 * This used to be @react-three/fiber. It was dropped for two reasons that both
 * come back to owning the frame: fiber builds its store around
 * `new THREE.Clock()`, deprecated since r183, which warned on every mount with
 * nothing callable from this side to stop it — and its dist is 638KB against
 * three's own 647KB, on the heaviest chunk the site loads. What it bought us
 * was JSX for a scene graph that is built once and never re-rendered.
 *
 * Timing is `THREE.Timer`, connected to the document: a hidden tab reports a
 * delta of 0 and resets on return, instead of resuming with one huge jump.
 *
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

/** Retina is not worth the fill rate on a mesh this size. */
const MAX_PIXEL_RATIO = 1.75

export function SkullCanvas({
  active,
  onReady,
  onError,
}: {
  active: boolean
  onReady: () => void
  onError: (reason: unknown) => void
}) {
  const hostRef = useRef<HTMLDivElement>(null)

  // Everything the loop needs from props, behind refs so none of it lands in
  // the scene effect dependency list — a parent re-render must never be able to
  // tear down WebGL. `active` in particular flips on every scroll past the
  // hero, and rebuilding the renderer for that would be absurd.
  //
  // Synced in an effect, not assigned during render, which React forbids.
  // Declared above the scene effect so it has already run when the loop starts.
  const activeRef = useRef(active)
  const readyRef = useRef(onReady)
  const errorRef = useRef(onError)

  useEffect(() => {
    activeRef.current = active
    readyRef.current = onReady
    errorRef.current = onError
  })

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    let disposed = false
    let frame = 0
    let renderer: WebGLRenderer

    // Context creation throws on a machine with no WebGL, and it happens here
    // rather than during render, so the error boundary upstream would never see
    // it. Hand it to the caller instead, which puts the poster back.
    try {
      renderer = new WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      })
    } catch (reason) {
      errorRef.current(reason)
      return
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO))
    renderer.toneMapping = ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.08
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = PCFShadowMap
    // Shader diagnostics cost a synchronous GPU round trip on first use: three
    // calls getProgramInfoLog and reads LINK_STATUS, and the driver has to
    // finish compiling before it can answer. Worth paying while you are editing
    // shaders, not worth paying on every visitor's first frame.
    renderer.debug.checkShaderErrors = process.env.NODE_ENV === "development"

    renderer.domElement.style.display = "block"
    renderer.domElement.style.width = "100%"
    renderer.domElement.style.height = "100%"
    host.appendChild(renderer.domElement)

    const scene = new Scene()
    // The procedural room is for soft shading only; at full strength it washes
    // the orange toward cream.
    scene.environmentIntensity = 0.14

    const camera = new PerspectiveCamera(32, 1, 0.1, 1000)
    camera.position.set(0, 0, 5.4)

    /**
     * Procedural image-based lighting. `RoomEnvironment` is generated
     * in-process, so the PBR materials get soft directional response with no
     * HDRI download.
     */
    const pmrem = new PMREMGenerator(renderer)
    const room = new RoomEnvironment()
    const environment = pmrem.fromScene(room, 0.04).texture
    scene.environment = environment
    pmrem.dispose()
    room.dispose()

    // Hard key, high and to the left, as in the product photography. It is the
    // only shadow caster: one decisive light source is what gives the skull its
    // contrast.
    const key = new DirectionalLight("#ffeedd", 5.6)
    key.position.set(-3.4, 4.4, 1.9)
    key.castShadow = true
    key.shadow.mapSize.set(2048, 2048)
    // Bias pair tuned for a double-sided mesh: without normalBias the curved
    // cranium stipples itself with shadow acne.
    key.shadow.bias = -0.0006
    key.shadow.normalBias = 0.025
    key.shadow.camera.near = 0.1
    key.shadow.camera.far = 14
    key.shadow.camera.left = -2.4
    key.shadow.camera.right = 2.4
    key.shadow.camera.top = 2.4
    key.shadow.camera.bottom = -2.4
    key.shadow.camera.updateProjectionMatrix()

    // Hot blaze kicker raking the right edge, so the silhouette stays lit
    // against a black page even when the face turns away.
    const kicker = new PointLight("#ff5a1f", 85, 22)
    kicker.position.set(3.6, 0.5, -1.2)

    // Cool counter-rim on the opposite edge, separating skull from ground.
    const rim = new PointLight("#7c5cff", 45, 22)
    rim.position.set(-3.4, 1.6, -2.4)

    // Weak warm bounce under the jaw, so the teeth do not fall to black.
    const bounce = new PointLight("#ff8a4a", 9, 14)
    bounce.position.set(0.4, -2.8, 2.2)

    // Dim, cool bounce so the shadow side keeps detail without going grey.
    // Ambient is the single biggest cause of a flat, plastic-toy look.
    const ambient = new AmbientLight("#3a3a52", 0.07)

    scene.add(key, kicker, rim, bounce, ambient)

    // Pivot the animation drives, with the model parented inside it already
    // centred and normalised — so rotation happens about the skull, not about
    // whatever origin the exporter happened to leave behind.
    const pivot = new Group()
    scene.add(pivot)

    const resize = () => {
      const { clientWidth, clientHeight } = host
      if (clientWidth === 0 || clientHeight === 0) return
      renderer.setSize(clientWidth, clientHeight, false)
      camera.aspect = clientWidth / clientHeight
      camera.updateProjectionMatrix()
    }
    resize()

    const observer = new ResizeObserver(resize)
    observer.observe(host)

    const timer = new Timer()
    timer.connect(document)

    const follow = { x: 0, y: 0 }
    let model: Group | null = null

    const loop = () => {
      frame = requestAnimationFrame(loop)
      // Stop drawing once the hero scrolls away. The rAF keeps ticking so the
      // timer stays honest, but nothing is submitted to the GPU.
      if (!activeRef.current) return

      timer.update()
      // Timer already zeroes the delta for a hidden tab; this is the backstop
      // for an ordinary stalled frame — a long GC, or the first frame after the
      // model finishes decoding.
      const d = Math.min(timer.getDelta(), 0.05)
      const i = getSkullInteraction()

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
      // toward the bottom of the screen - so they share a sign. Negating it
      // here made the skull look up as the cursor went down.
      follow.x += (i.pointer.y * MAX_PITCH - follow.x) * t
      follow.y += (i.pointer.x * MAX_YAW - follow.y) * t

      pivot.rotation.x = follow.x + i.userRot.x
      pivot.rotation.y = MODEL_YAW_OFFSET + follow.y + i.userRot.y
      pivot.position.y = OPTICAL_CENTRE_LIFT + Math.sin(timer.getElapsed() * 0.55) * 0.045

      renderer.render(scene, camera)
    }

    const loader = new GLTFLoader()
    loader.load(
      "/product/skull.glb",
      (gltf) => {
        if (disposed) return

        const root = gltf.scene

        // Generators ship these meshes as metalness 1 / roughness 1. That is
        // wrong for matte PLA: a fully metallic surface takes its colour from
        // reflections rather than its own base map, which turns the orange into
        // washed-out grey plastic. Retag it as the dielectric it actually is.
        root.traverse((child) => {
          const mesh = child as Mesh
          if (!mesh.isMesh) return
          const material = mesh.material as MeshStandardMaterial
          material.metalness = 0.0
          // The generator's roughness map is dropped rather than scaled: three
          // multiplies `roughness` by the map, so a glossy map keeps blown-out
          // hotspots no matter how high the scalar goes. A uniform value gives
          // one broad, controllable sheen instead. Not fully diffuse, though -
          // at 1.0 the surface loses every specular cue and reads as moulded
          // toy plastic. The normal map stays: that is where the flame relief
          // and layer lines live.
          material.roughnessMap = null
          material.roughness = 0.58
          material.envMapIntensity = 0.3

          // Self-shadowing is what carves the eye sockets and the flame
          // grooves. Without it the form is only shaded by lambert falloff,
          // which is flat.
          mesh.castShadow = true
          mesh.receiveShadow = true
        })

        const box = new Box3().setFromObject(root)
        const size = box.getSize(new Vector3())
        const centre = box.getCenter(new Vector3())
        const longest = Math.max(size.x, size.y, size.z) || 1
        // Normalised so the longest axis fills most of the frame. Kept under
        // the full 3.1-unit view height so a dragged skull, which is deeper
        // than it is wide, cannot clip the edges mid-spin.
        const scale = 2.5 / longest

        root.position.set(-centre.x, -centre.y, -centre.z)

        const scaled = new Group()
        scaled.scale.setScalar(scale)
        scaled.add(root)
        pivot.add(scaled)
        model = scaled

        readyRef.current()
      },
      undefined,
      (reason) => {
        if (disposed) return
        errorRef.current(reason)
      },
    )

    frame = requestAnimationFrame(loop)

    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      observer.disconnect()
      timer.dispose()

      // three does not walk the graph for you: every geometry, material and
      // texture holds GPU memory until it is told otherwise, and this canvas
      // can mount more than once per session.
      if (model) {
        model.traverse((child) => {
          const mesh = child as Mesh
          if (!mesh.isMesh) return
          mesh.geometry.dispose()
          const material = mesh.material as MeshStandardMaterial
          material.map?.dispose()
          material.normalMap?.dispose()
          material.metalnessMap?.dispose()
          material.dispose()
        })
      }
      environment.dispose()
      key.shadow.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [])

  return <div ref={hostRef} className="size-full" />
}

export default SkullCanvas
