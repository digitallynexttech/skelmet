import {
  ACESFilmicToneMapping,
  AmbientLight,
  Box3,
  Color,
  DirectionalLight,
  Group,
  LightProbe,
  Matrix4,
  PCFShadowMap,
  PerspectiveCamera,
  PointLight,
  Scene,
  Vector3,
  WebGLRenderer,
  type Mesh,
  type MeshStandardMaterial,
} from "three"
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js"
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js"
import { ConvexHull } from "three/examples/jsm/math/ConvexHull.js"

import { BOB_PERIOD, BOB_RISE } from "@/components/marketing/skull-interaction"
import {
  BLEED_FOV,
  CAMERA_Z,
  OPTICAL_CENTRE_LIFT,
  SKULL_HEIGHT,
  VIEW_HEIGHT,
} from "@/components/marketing/skull-optics"

/**
 * The hero's three.js scene and draw loop, with no DOM: it normally runs in a
 * worker (skull-worker) on an OffscreenCanvas, so parsing, shader compiles and
 * draws stay off the page's main thread. Without worker WebGL, skull-renderer
 * runs it on the main thread. Plain three.js on purpose: @react-three/fiber
 * nearly doubled the heaviest chunk and warned on every mount.
 */

/** Retina is not worth the fill rate on a mesh this size. */
const MAX_PIXEL_RATIO = 1.75

/**
 * Touch screens: lower pixel ratio and shadow map, so the GPU keeps the scroll
 * smooth. Still antialiased: the canvas is stretched, and stretched hard edges stair-step.
 */
const TOUCH = { pixelRatio: 1.5, shadowMapSize: 1024 }

/**
 * Adaptive resolution: when over half of a run of turning draws come more than
 * slowDrawMs apart, the pixel ratio steps down to the floor. It never steps back
 * up (sharpen-then-soften looks worse). Gaps over stalledMs are pauses, ignored.
 */
const PACE = { run: 40, slowDrawMs: 24, stalledMs: 100, step: 0.25, floor: 1 }

/** An idle skull only bobs, so it is drawn every 50 ms, not every display frame. */
const IDLE_FRAME_MS = 50

/** Yaw at load so the skull faces the viewer; set against the rendered result. */
const MODEL_YAW_OFFSET = 0

/**
 * Two lighting rigs, blended by how seated the skull is in a photo. Stage is
 * the hero's, for a black page. Studio matches the product photos (soft key
 * upper left, neutral fill), so a landed skull matches the photographed ones.
 */
const STAGE = {
  key: 5.6,
  kicker: 85,
  rim: 45,
  bounce: 9,
  ambient: 0.07,
  room: 0.14,
  exposure: 1.08,
  roughness: 0.58,
}
const STUDIO = {
  key: 4.8,
  kicker: 0,
  rim: 0,
  bounce: 4,
  ambient: 0.085,
  room: 0.17,
  exposure: 0.83,
  roughness: 0.8,
}
/**
 * Soft room light as second-order spherical harmonics (same in R, G, B),
 * measured once from three.js's RoomEnvironment. A probe, not an environment
 * map: building the map at start costs extra shader compiles that freeze the
 * whole page. ROOM_GAIN makes up for the sheen the map gave.
 */
const ROOM = [3.7119, 1.7183, 1.6268, 0.2877, 0.2338, 1.0789, 1.2682, -0.34, -0.6285]
const ROOM_GAIN = 1.15

/** The key's warmth flatters the hero and oversaturates a skull beside neutral-lit photos. */
const STAGE_KEY = new Color("#ffeedd")
const STUDIO_KEY = new Color("#ffffff")
const STAGE_AMBIENT = new Color("#3a3a52")
const STUDIO_AMBIENT = new Color("#e6e1d8")

/** How the skull is turned, and lit, this frame. */
export type SkullPose = {
  /** Rotation about the pivot, radians, as one XYZ Euler. */
  x: number
  y: number
  z: number
  /** The idle bob, 0..1: full in the hero, none seated in a photograph. */
  bob: number
  /** Lighting, 0 for the hero's stage rig to 1 for the photographs' studio. */
  studio: number
}

export type SkullSceneInit = {
  canvas: HTMLCanvasElement | OffscreenCanvas
  model: ArrayBuffer
  /** A touch screen: the lighter renderer. */
  touch: boolean
  devicePixelRatio: number
  /** The canvas's size on the page, CSS px. */
  width: number
  height: number
  /** Reduce the surface to its convex hull: exact, but a second's work only a worker can spare. */
  hull: boolean
}

export type SkullModelInfo = {
  /** Points on the model in pivot space, x y z in turn: the outline is measured off these. */
  surface: Float32Array
  /** Its width, height and depth, as scaled. */
  extent: [number, number, number]
}

export type SkullSceneEvents = {
  /** The model is drawn and on the canvas. */
  onReady: (info: SkullModelInfo) => void
  /** The WebGL context is gone: the canvas is blank from here on. */
  onLost: () => void
  /** It never started: no WebGL, or a model that would not parse. */
  onError: (message: string) => void
}

export type SkullScene = {
  resize: (width: number, height: number) => void
  pose: (pose: SkullPose) => void
  /** When the bob began, in milliseconds since the epoch. */
  clock: (bobStart: number) => void
  /** Off screen, or off the page: nothing is drawn until it is back. */
  visible: (visible: boolean) => void
  dispose: () => void
}

/** Epoch milliseconds at performance.now() precision: the same on every thread. */
const wallClock = () => performance.timeOrigin + performance.now()

/** A worker has requestAnimationFrame wherever it can have a canvas; the timer is for the rest. */
const nextFrame: (run: () => void) => number =
  typeof requestAnimationFrame === "function"
    ? (run) => requestAnimationFrame(run)
    : (run) => setTimeout(run, 16) as unknown as number
const cancelFrame: (id: number) => void =
  typeof cancelAnimationFrame === "function"
    ? (id) => cancelAnimationFrame(id)
    : (id) => clearTimeout(id)

/** Trace marks, in order: skull:start, context, lit, parsed, outlined, compiled, shown. */
const mark = (name: string) => performance.mark(`skull:${name}`)

export function createSkullScene(
  init: SkullSceneInit,
  events: SkullSceneEvents,
): SkullScene | null {
  mark("start")
  let renderer: WebGLRenderer
  // Throws with no WebGL, or in a worker that is not allowed one.
  try {
    renderer = new WebGLRenderer({
      canvas: init.canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    })
  } catch (reason) {
    events.onError(reason instanceof Error ? reason.message : "No WebGL context")
    return null
  }

  let pixelRatio = Math.min(init.devicePixelRatio, init.touch ? TOUCH.pixelRatio : MAX_PIXEL_RATIO)
  renderer.setPixelRatio(pixelRatio)
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = STAGE.exposure
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = PCFShadowMap
  // Shader error checks force a synchronous GPU round trip on first use: dev only.
  renderer.debug.checkShaderErrors = process.env.NODE_ENV === "development"
  mark("context")

  const scene = new Scene()

  // Widened by the bleed; the stage region of the view is the stage camera's image exactly.
  const camera = new PerspectiveCamera(BLEED_FOV, 1, 0.1, 1000)
  camera.position.set(0, 0, CAMERA_Z)

  // Soft shading only; at full strength it washes the orange toward cream.
  const room = new LightProbe(undefined, STAGE.room)
  ROOM.forEach((light, k) => room.sh.coefficients[k]!.setScalar(light * ROOM_GAIN))

  // Hard key, upper left as in the product photos; the only shadow caster.
  const key = new DirectionalLight(STAGE_KEY.clone(), STAGE.key)
  key.position.set(-3.4, 4.4, 1.9)
  key.castShadow = true
  const shadowSize = init.touch ? TOUCH.shadowMapSize : 2048
  key.shadow.mapSize.set(shadowSize, shadowSize)
  // Tuned for a double-sided mesh: without normalBias the cranium gets shadow acne.
  key.shadow.bias = -0.0006
  key.shadow.normalBias = 0.025
  key.shadow.camera.near = 0.1
  key.shadow.camera.far = 14
  key.shadow.camera.left = -2.4
  key.shadow.camera.right = 2.4
  key.shadow.camera.top = 2.4
  key.shadow.camera.bottom = -2.4
  key.shadow.camera.updateProjectionMatrix()

  // Orange kicker on the right edge keeps the silhouette lit against the black page.
  const kicker = new PointLight("#ff5a1f", STAGE.kicker, 22)
  kicker.position.set(3.6, 0.5, -1.2)

  // Cool counter-rim on the opposite edge, separating skull from ground.
  const rim = new PointLight("#7c5cff", STAGE.rim, 22)
  rim.position.set(-3.4, 1.6, -2.4)

  // Weak warm bounce under the jaw, so the teeth do not fall to black.
  const bounce = new PointLight("#ff8a4a", STAGE.bounce, 14)
  bounce.position.set(0.4, -2.8, 2.2)

  // Kept dim: strong ambient makes the skull look like flat plastic.
  const ambient = new AmbientLight(STAGE_AMBIENT.clone(), STAGE.ambient)

  scene.add(key, kicker, rim, bounce, ambient, room)
  mark("lit")

  /** The skull's own surfaces, filled when the model loads, for the rig's roughness. */
  const materials: MeshStandardMaterial[] = []

  /** Lights, exposure and surface, `s` of the way from stage to studio. */
  const rig = (s: number) => {
    const mix = (stage: number, studio: number) => stage + (studio - stage) * s
    key.intensity = mix(STAGE.key, STUDIO.key)
    key.color.lerpColors(STAGE_KEY, STUDIO_KEY, s)
    kicker.intensity = mix(STAGE.kicker, STUDIO.kicker)
    rim.intensity = mix(STAGE.rim, STUDIO.rim)
    bounce.intensity = mix(STAGE.bounce, STUDIO.bounce)
    ambient.intensity = mix(STAGE.ambient, STUDIO.ambient)
    ambient.color.lerpColors(STAGE_AMBIENT, STUDIO_AMBIENT, s)
    room.intensity = mix(STAGE.room, STUDIO.room)
    renderer.toneMappingExposure = mix(STAGE.exposure, STUDIO.exposure)
    for (const m of materials) m.roughness = mix(STAGE.roughness, STUDIO.roughness)
  }

  // The model is centred inside the pivot, so it turns about the skull, not the exporter's origin.
  const pivot = new Group()
  scene.add(pivot)

  const size = { width: 0, height: 0 }
  const resize = (width: number, height: number) => {
    if (width === 0 || height === 0) return
    if (width === size.width && height === size.height) return
    size.width = width
    size.height = height
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
  }
  resize(init.width, init.height)

  let disposed = false
  let lost = false
  let shown = true
  let frame = 0
  let model: Group | null = null
  let bobStart = wallClock()
  const pose: SkullPose = { x: 0, y: 0, z: 0, bob: 1, studio: 0 }
  /** The pose last submitted to the GPU, so an idle skull costs no draws. */
  const drawn = { x: NaN, y: NaN, z: NaN, lift: NaN, width: 0, height: 0, studio: NaN, at: 0 }

  const onLost = (event: Event) => {
    event.preventDefault()
    lost = true
    events.onLost()
  }
  init.canvas.addEventListener("webglcontextlost", onLost)

  /** Draws on the turn since the pixel ratio was last judged, and how many came late. */
  const pace = { draws: 0, late: 0 }
  const judge = (gap: number) => {
    if (gap > PACE.stalledMs) return
    pace.draws += 1
    if (gap > PACE.slowDrawMs) pace.late += 1
    if (pace.draws < PACE.run) return
    const struggling = pace.late > pace.draws / 2
    pace.draws = 0
    pace.late = 0
    if (!struggling || pixelRatio <= PACE.floor) return
    pixelRatio = Math.max(PACE.floor, pixelRatio - PACE.step)
    renderer.setPixelRatio(pixelRatio)
    renderer.setSize(size.width, size.height, false)
    // Resizing cleared the canvas: force the next draw.
    drawn.width = 0
  }

  /** Draw, if anything about the skull has changed since the last draw. */
  const draw = () => {
    if (!model || lost || size.width === 0) return
    pivot.rotation.x = pose.x
    pivot.rotation.y = MODEL_YAW_OFFSET + pose.y
    pivot.rotation.z = pose.z
    // On the poster's clock, so the first frame matches the poster (see BOB_PERIOD).
    const bob = (((wallClock() - bobStart) / 1000) * 2 * Math.PI) / BOB_PERIOD
    pivot.position.y = OPTICAL_CENTRE_LIFT + Math.cos(bob) * BOB_RISE * VIEW_HEIGHT * pose.bob

    // Quantised so a skull at a dock's edge does not relight on every sub-pixel of scroll.
    const studio = Math.round(pose.studio * 200) / 200
    const moved =
      studio !== drawn.studio ||
      Math.abs(pivot.rotation.x - drawn.x) > 1e-5 ||
      Math.abs(pivot.rotation.y - drawn.y) > 1e-5 ||
      Math.abs(pivot.rotation.z - drawn.z) > 1e-5 ||
      size.width !== drawn.width ||
      size.height !== drawn.height
    const bobbed = Math.abs(pivot.position.y - drawn.lift) > 1e-5
    const now = performance.now()
    if (!moved && !(bobbed && now - drawn.at >= IDLE_FRAME_MS)) return
    if (studio !== drawn.studio) rig(studio)
    renderer.render(scene, camera)
    // Only the turning skull is paced: idle, it is drawn on a timer.
    if (moved) judge(now - drawn.at)
    drawn.at = now
    drawn.studio = studio
    drawn.x = pivot.rotation.x
    drawn.y = pivot.rotation.y
    drawn.z = pivot.rotation.z
    drawn.lift = pivot.position.y
    drawn.width = size.width
    drawn.height = size.height
  }

  // Runs while the skull bobs; seated in a photo it stops until the next pose.
  const loop = () => {
    frame = 0
    if (disposed || !shown) return
    draw()
    if (pose.bob > 1e-3) frame = nextFrame(loop)
  }
  const wake = () => {
    if (!frame && !disposed && shown && model) frame = nextFrame(loop)
  }

  // The mesh is meshopt-compressed: without the decoder the loader rejects it.
  const loader = new GLTFLoader()
  loader.setMeshoptDecoder(MeshoptDecoder)
  const onParsed = (gltf: GLTF) => {
    if (disposed) return
    mark("parsed")
    const root = gltf.scene

    // One flat colour and no maps (scripts/build-skull-model.mjs), so the
    // surface is set here. Matte PLA: metalness 0, or the orange turns grey.
    root.traverse((child) => {
      const mesh = child as Mesh
      if (!mesh.isMesh) return
      const material = mesh.material as MeshStandardMaterial
      material.metalness = 0.0
      // Uniform roughness, below 1.0: fully diffuse reads as toy plastic.
      material.roughnessMap = null
      material.roughness = STAGE.roughness

      // Self-shadowing carves the eye sockets and flame grooves.
      materials.push(material)
      mesh.castShadow = true
      mesh.receiveShadow = true
    })

    const box = new Box3().setFromObject(root)
    const extent = box.getSize(new Vector3())
    const centre = box.getCenter(new Vector3())
    // Sized by height, not the longest axis, which changes with the tilt.
    const scale = SKULL_HEIGHT / (extent.y || 1)

    root.position.set(-centre.x, -centre.y, -centre.z)

    const scaled = new Group()
    scaled.scale.setScalar(scale)
    scaled.add(root)
    pivot.add(scaled)
    extent.multiplyScalar(scale)

    // Compile before the first draw (on driver threads where available);
    // inside the draw it is one long stall.
    pivot.updateMatrixWorld(true)
    const compiled = renderer.compileAsync(scene, camera).catch(() => {
      // Compiled on first draw instead; slower, not broken.
    })

    // Meanwhile, sample the surface for the outline the page fits to the photos.
    const surface = sampleSurface(root, new Matrix4().copy(pivot.matrixWorld).invert(), init.hull)
    mark("outlined")

    void compiled.then(() => {
      if (disposed) return
      mark("compiled")
      model = scaled
      drawn.studio = NaN
      // Report ready a frame after the draw, so the poster goes only once the picture is up.
      draw()
      nextFrame(() => {
        if (disposed) return
        mark("shown")
        events.onReady({ surface, extent: [extent.x, extent.y, extent.z] })
        wake()
      })
    })
  }
  try {
    loader.parse(init.model, "", onParsed, (reason: unknown) => {
      if (!disposed)
        events.onError(reason instanceof Error ? reason.message : "Model did not parse")
    })
  } catch (reason) {
    events.onError(reason instanceof Error ? reason.message : "Model did not parse")
  }

  return {
    resize: (width, height) => {
      resize(width, height)
      wake()
    },
    pose: (next) => {
      pose.x = next.x
      pose.y = next.y
      pose.z = next.z
      pose.bob = next.bob
      pose.studio = next.studio
      wake()
    },
    clock: (start) => {
      bobStart = start
    },
    visible: (visible) => {
      shown = visible
      if (visible) {
        // The canvas may have been cleared while hidden; draw afresh.
        drawn.studio = NaN
        wake()
      }
    },
    dispose: () => {
      disposed = true
      cancelFrame(frame)
      init.canvas.removeEventListener("webglcontextlost", onLost)
      // three does not free GPU memory for you.
      model?.traverse((child) => {
        const mesh = child as Mesh
        if (!mesh.isMesh) return
        mesh.geometry.dispose()
        ;(mesh.material as MeshStandardMaterial).dispose()
      })
      key.shadow.dispose()
      renderer.dispose()
    },
  }
}

/**
 * Points on the model, in pivot space. The convex hull's corners give the exact
 * outline from any angle with far fewer points, but the hull is slow to build;
 * without it, about 40,000 mesh points are sampled.
 */
function sampleSurface(root: Group, toPivot: Matrix4, hull: boolean): Float32Array {
  const points: Vector3[] = []
  root.traverse((child) => {
    const mesh = child as Mesh
    if (!mesh.isMesh) return
    const position = mesh.geometry.getAttribute("position")
    const toLocal = new Matrix4().multiplyMatrices(toPivot, mesh.matrixWorld)
    const step = hull ? 1 : Math.max(1, Math.floor(position.count / 40000))
    for (let k = 0; k < position.count; k += step) {
      points.push(new Vector3().fromBufferAttribute(position, k).applyMatrix4(toLocal))
    }
  })

  let kept = points
  if (hull) {
    try {
      const corners = new Set<Vector3>()
      for (const face of new ConvexHull().setFromPoints(points).faces) {
        let edge = face.edge
        do {
          corners.add(edge.head().point)
          edge = edge.next
        } while (edge !== face.edge)
      }
      if (corners.size >= 4) kept = [...corners]
    } catch {
      // A degenerate cloud has no hull; the full cloud still works.
    }
  }

  const surface = new Float32Array(kept.length * 3)
  kept.forEach((p, k) => surface.set([p.x, p.y, p.z], k * 3))
  return surface
}
