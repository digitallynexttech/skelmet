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
 * The hero mesh: the three.js scene, its lights and its draw loop, and
 * nothing of the page. It is handed a canvas and told how the skull is
 * turned; where that canvas sits on the page is skull-canvas's business.
 *
 * No DOM in here, because this normally runs in a worker (skull-worker) on
 * an OffscreenCanvas. Everything that made the model expensive to show -
 * evaluating three.js, decoding the mesh, compiling shaders, the draw itself -
 * then happens off the thread the page scrolls and animates on. It used to
 * run there: on a mid-range phone starting the model froze the page for over
 * a second, at the moment of the visitor's first touch, and every frame of a
 * scroll paid for a draw. A browser that cannot give a worker a WebGL canvas
 * runs this same file on the main thread instead (skull-renderer).
 *
 * This used to be @react-three/fiber. It was dropped for two reasons that both
 * come back to owning the frame: fiber builds its store around
 * `new THREE.Clock()`, deprecated since r183, which warned on every mount with
 * nothing callable from this side to stop it - and its dist is 638KB against
 * three's own 647KB, on the heaviest chunk the site loads. What it bought us
 * was JSX for a scene graph that is built once and never re-rendered.
 */

/** Retina is not worth the fill rate on a mesh this size. */
const MAX_PIXEL_RATIO = 1.75

/**
 * Touch screens get a lighter renderer: a phone's GPU is better spent keeping
 * the scroll smooth than on a sharper skull. A lower pixel ratio and a
 * quarter-size shadow map. Edges are still antialiased: below the screen's
 * own pixel ratio the canvas is stretched to fit, and a stretched hard edge
 * is a staircase beside the poster it takes over from.
 */
const TOUCH = { pixelRatio: 1.5, shadowMapSize: 1024 }

/**
 * Those are where it starts. A graphics chip that cannot keep up at that
 * size is given fewer pixels: when more than half of a run of consecutive
 * draws - the skull turning, as it does all through a flight - come later
 * than SLOW_DRAW_MS apart, the pixel ratio steps down, as far as the floor.
 * It never steps back up: a skull that sharpens and softens is worse than a
 * soft one. A gap over STALLED_MS is not slowness but a pause - a hidden tab,
 * a skull that stopped turning - and is left out.
 */
const PACE = { run: 40, slowDrawMs: 24, stalledMs: 100, step: 0.25, floor: 1 }

/**
 * An idle skull's only motion is the bob, a slow drift nobody reads frame by
 * frame. Drawn every 50 ms rather than every display frame (60-120 Hz), so a
 * skull just sitting in the hero costs a fraction of the GPU it did.
 */
const IDLE_FRAME_MS = 50

/**
 * Yaw applied once at load so the skull rests facing the viewer. Generators do
 * not agree on which way "forward" ends up, so this is measured against the
 * rendered result rather than assumed.
 */
const MODEL_YAW_OFFSET = 0

/**
 * Two lighting rigs, blended by how seated the skull is in a photo.
 *
 * Stage is the hero's, built for a black page: a hot orange kicker and a violet
 * rim keep the silhouette alive against nothing. Carried into a product card
 * it made the landed skull glossier and more saturated than the photographed
 * ones beside it, with violet pooling in the eye sockets and teeth, and the
 * other two cards read as dull by comparison. Studio is what the photos were
 * shot under - one soft key from the upper left, a neutral fill, no coloured
 * edges - so the skull that lands reads as the same object as the rest.
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
 * The room the skull stands in: soft light from every side, which is what
 * keeps the shadowed half of the face from falling to black. Nine numbers -
 * the light arriving from each direction as second-order spherical harmonics,
 * the same in red, green and blue because the room is white.
 *
 * It is three.js's RoomEnvironment, measured once (LightProbeGenerator on a
 * cube render of it). The scene used to build that room and blur it into an
 * environment map on every start: four more shader programs, compiled and
 * drawn with before anything else could happen. On a first visit that was
 * over a second in which the graphics process could do nothing else - and
 * since the page is drawn by the same process, the whole page stood still
 * for it, at the moment of the visitor's first touch. A probe is a uniform.
 *
 * A map also gave the surface a faint sheen of the room, which a probe has
 * no way to: ROOM_GAIN is that much more of the soft light, in its place.
 * Set by eye and by difference against the map - the two pictures of the
 * skull at rest are within a few levels of each other over all but its edge.
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
  /** The model file's bytes. */
  model: ArrayBuffer
  /** A touch screen: the lighter renderer. */
  touch: boolean
  devicePixelRatio: number
  /** The canvas's size on the page, CSS px. */
  width: number
  height: number
  /**
   * Cut the surface down to its convex hull before handing it back. Exact
   * for an outline and a fraction of the points, but a second's work that
   * only a worker has to spare.
   */
  hull: boolean
}

/** What the page needs to know about the model once it is up. */
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

/** Milliseconds since the epoch, to the precision of performance.now(): the same on every thread. */
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

/**
 * A named moment in the scene's start, for a performance trace: in order,
 * skull:start, context, lit, parsed, outlined, compiled, shown.
 */
const mark = (name: string) => performance.mark(`skull:${name}`)

export function createSkullScene(
  init: SkullSceneInit,
  events: SkullSceneEvents,
): SkullScene | null {
  mark("start")
  let renderer: WebGLRenderer
  // Context creation throws on a machine with no WebGL - or in a worker that
  // is not allowed one.
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
  // Shader diagnostics cost a synchronous GPU round trip on first use: three
  // calls getProgramInfoLog and reads LINK_STATUS, and the driver has to
  // finish compiling before it can answer. Worth paying while you are editing
  // shaders, not worth paying on every visitor's first frame.
  renderer.debug.checkShaderErrors = process.env.NODE_ENV === "development"
  mark("context")

  const scene = new Scene()

  // Opened from the stage's 32° by the bleed: the tangent scales, so the
  // stage region of the wider view is the stage camera's image exactly.
  const camera = new PerspectiveCamera(BLEED_FOV, 1, 0.1, 1000)
  camera.position.set(0, 0, CAMERA_Z)

  // The room is for soft shading only; at full strength it washes the orange
  // toward cream.
  const room = new LightProbe(undefined, STAGE.room)
  ROOM.forEach((light, k) => room.sh.coefficients[k]!.setScalar(light * ROOM_GAIN))

  // Hard key, high and to the left, as in the product photography. It is the
  // only shadow caster: one decisive light source is what gives the skull its
  // contrast.
  const key = new DirectionalLight(STAGE_KEY.clone(), STAGE.key)
  key.position.set(-3.4, 4.4, 1.9)
  key.castShadow = true
  const shadowSize = init.touch ? TOUCH.shadowMapSize : 2048
  key.shadow.mapSize.set(shadowSize, shadowSize)
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
  const kicker = new PointLight("#ff5a1f", STAGE.kicker, 22)
  kicker.position.set(3.6, 0.5, -1.2)

  // Cool counter-rim on the opposite edge, separating skull from ground.
  const rim = new PointLight("#7c5cff", STAGE.rim, 22)
  rim.position.set(-3.4, 1.6, -2.4)

  // Weak warm bounce under the jaw, so the teeth do not fall to black.
  const bounce = new PointLight("#ff8a4a", STAGE.bounce, 14)
  bounce.position.set(0.4, -2.8, 2.2)

  // Dim, cool bounce so the shadow side keeps detail without going grey.
  // Ambient is the single biggest cause of a flat, plastic-toy look.
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

  // Pivot the animation drives, with the model parented inside it already
  // centred and normalised - so rotation happens about the skull, not about
  // whatever origin the exporter happened to leave behind.
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
    // The canvas is a new size and empty: the next frame draws whatever else is true.
    drawn.width = 0
  }

  /** Draw, if anything about the skull has changed since the last draw. */
  const draw = () => {
    if (!model || lost || size.width === 0) return
    pivot.rotation.x = pose.x
    pivot.rotation.y = MODEL_YAW_OFFSET + pose.y
    pivot.rotation.z = pose.z
    // On the poster's clock, so the frame that replaces the poster is the one
    // it was showing (see BOB_PERIOD).
    const bob = (((wallClock() - bobStart) / 1000) * 2 * Math.PI) / BOB_PERIOD
    pivot.position.y = OPTICAL_CENTRE_LIFT + Math.cos(bob) * BOB_RISE * VIEW_HEIGHT * pose.bob

    // Stage light in the hero and in flight, studio light once seated in a
    // photo. Quantised, so a skull hovering at the edge of a dock does not
    // relight and redraw on every sub-pixel of scroll.
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

  // Runs while the skull bobs, which is its only motion of its own. Seated in
  // a photograph it does not, and the loop stops until it is told of a turn.
  const loop = () => {
    frame = 0
    if (disposed || !shown) return
    draw()
    if (pose.bob > 1e-3) frame = nextFrame(loop)
  }
  const wake = () => {
    if (!frame && !disposed && shown && model) frame = nextFrame(loop)
  }

  // The mesh ships meshopt-compressed (EXT_meshopt_compression), which cut
  // it from 8.9 MB to under 1 MB with the triangle count untouched. The
  // decoder is NOT optional: without it the loader rejects the file outright
  // and the hero never gets past its poster.
  const loader = new GLTFLoader()
  loader.setMeshoptDecoder(MeshoptDecoder)
  const onParsed = (gltf: GLTF) => {
    if (disposed) return
    mark("parsed")
    const root = gltf.scene

    // The model is built from the print file (scripts/build-skull-model.mjs):
    // one flat filament colour and no maps, so the surface is set here
    // rather than trusted from the file. Matte PLA is a dielectric, so
    // metalness 0: a metallic surface takes its colour from reflections
    // rather than its own, and turned the orange into grey plastic.
    root.traverse((child) => {
      const mesh = child as Mesh
      if (!mesh.isMesh) return
      const material = mesh.material as MeshStandardMaterial
      material.metalness = 0.0
      // A uniform roughness gives one broad, controllable sheen. Not fully
      // diffuse, though - at 1.0 the surface loses every specular cue and
      // reads as moulded toy plastic.
      material.roughnessMap = null
      material.roughness = STAGE.roughness

      // Self-shadowing is what carves the eye sockets and the flame
      // grooves. Without it the form is only shaded by lambert falloff,
      // which is flat.
      materials.push(material)
      mesh.castShadow = true
      mesh.receiveShadow = true
    })

    const box = new Box3().setFromObject(root)
    const extent = box.getSize(new Vector3())
    const centre = box.getCenter(new Vector3())
    // Normalised by height (SKULL_HEIGHT): the print is deeper than it is
    // tall once tilted to meet the eye, and sizing by the longest axis
    // made its size depend on the tilt. Turned side-on it reaches past
    // the stage, into the canvas's bleed.
    const scale = SKULL_HEIGHT / (extent.y || 1)

    root.position.set(-centre.x, -centre.y, -centre.z)

    const scaled = new Group()
    scaled.scale.setScalar(scale)
    scaled.add(root)
    pivot.add(scaled)
    extent.multiplyScalar(scale)

    // Compile the shaders before the first draw, on the driver's own threads
    // where it has them. Done inside that draw it is one long stall - four
    // lights and a shadow pass.
    pivot.updateMatrixWorld(true)
    const compiled = renderer.compileAsync(scene, camera).catch(() => {
      // Compiled on first draw instead; slower, not broken.
    })

    // And while the driver is busy with that: the model's surface in pivot
    // space, for the outline the page seats on the photographs.
    const surface = sampleSurface(root, new Matrix4().copy(pivot.matrixWorld).invert(), init.hull)
    mark("outlined")

    void compiled.then(() => {
      if (disposed) return
      mark("compiled")
      model = scaled
      drawn.studio = NaN
      // Draw, and only say so a frame later: by then the picture is on the
      // canvas, and the poster can be taken away with nothing in between.
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
        // Whatever was drawn before may have been thrown away with the canvas's
        // place on the page; draw afresh.
        drawn.studio = NaN
        wake()
      }
    },
    dispose: () => {
      disposed = true
      cancelFrame(frame)
      init.canvas.removeEventListener("webglcontextlost", onLost)
      // three does not walk the graph for you: every geometry, material and
      // texture holds GPU memory until it is told otherwise.
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
 * Points on the model, in pivot space.
 *
 * The outline of a shape from any angle is the outline of its convex hull, so
 * the hull's corners - a few thousand of the mesh's ninety thousand points -
 * measure it exactly, and thirty times faster per angle. Building the hull is
 * the slow part, which is why it is optional: without it, every few points of
 * the mesh, about forty thousand in all, which pins the outline to well under
 * a pixel.
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
      // A degenerate cloud has no hull; the whole of it still measures true.
    }
  }

  const surface = new Float32Array(kept.length * 3)
  kept.forEach((p, k) => surface.set([p.x, p.y, p.z], k * 3))
  return surface
}
