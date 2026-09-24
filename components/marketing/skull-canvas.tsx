"use client"

import { useEffect, useRef, type RefObject } from "react"
import {
  ACESFilmicToneMapping,
  AmbientLight,
  Box3,
  DirectionalLight,
  Group,
  Matrix4,
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
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js"

import { getSkullInteraction, HALO_REST } from "@/components/marketing/skull-interaction"
import {
  journey,
  measureAnchors,
  REST_SILHOUETTE,
  type Anchor,
  type Silhouette,
} from "@/components/marketing/skull-journey"

/**
 * The hero mesh, driven directly against three.js.
 *
 * This used to be @react-three/fiber. It was dropped for two reasons that both
 * come back to owning the frame: fiber builds its store around
 * `new THREE.Clock()`, deprecated since r183, which warned on every mount with
 * nothing callable from this side to stop it - and its dist is 638KB against
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
 *
 * The canvas does not live in the hero. It is drawn into `flightRef`, a box
 * the size of the hero stage positioned in the document, and every frame the
 * loop asks skull-journey where the skull should be for the current scroll and
 * moves and scales that box to put it there - at home in the hero, docked over
 * a photograph further down, or flying between the two. Moving the box rather
 * than the camera keeps every number above (framing, lift, halo) true in the
 * box's own terms, and a transform on one element costs the compositor almost
 * nothing.
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
/** Flare per radian-per-second of spin, and its ceiling. A hard fling hits it. */
const HALO_FLARE_GAIN = 0.03
const HALO_FLARE_MAX = 0.35

/** Roll per px/s of sideways flight, and its ceiling: the skull banks into its turns. */
const BANK_GAIN = 0.0003
const BANK_MAX = 0.3

export function SkullCanvas({
  flightRef,
  onReady,
  onError,
}: {
  /** The positioned box the canvas fills, which the loop flies down the page. */
  flightRef: RefObject<HTMLDivElement | null>
  onReady: () => void
  onError: (reason: unknown) => void
}) {
  const hostRef = useRef<HTMLDivElement>(null)

  // Everything the loop needs from props, behind refs so none of it lands in
  // the scene effect dependency list - a parent re-render must never be able to
  // tear down WebGL.
  //
  // Synced in an effect, not assigned during render, which React forbids.
  // Declared above the scene effect so it has already run when the loop starts.
  const readyRef = useRef(onReady)
  const errorRef = useRef(onError)

  useEffect(() => {
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
    // centred and normalised - so rotation happens about the skull, not about
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
    /** Set once the context is lost: the canvas is blank, so nothing may dock. */
    let failed = false

    // The model's surface, sampled once it loads, in pivot space. The route
    // sizes the skull by its silhouette, and a dock can turn it side-on, so
    // the silhouette is measured off these at whatever angle is asked for.
    let surface: Float32Array | null = null
    const silhouettes = new Map<number, Silhouette>()
    const silhouette = (turn: number): Silhouette => {
      if (!surface || box.height === 0) return REST_SILHOUETTE
      // Quantised, so a flight easing between two angles reuses its answers.
      const key = Math.round(turn * 200) / 200
      const known = silhouettes.get(key)
      if (known) return known

      const cos = Math.cos(key)
      const sin = Math.sin(key)
      const tan = Math.tan((camera.fov * Math.PI) / 360)
      const aspect = box.width / box.height
      let minX = Infinity
      let maxX = -Infinity
      let minY = Infinity
      let maxY = -Infinity
      for (let k = 0; k < surface.length; k += 3) {
        const x = surface[k]!
        const y = surface[k + 1]! + OPTICAL_CENTRE_LIFT
        const z = surface[k + 2]!
        // Yaw about the pivot, as three applies rotation.y, then the
        // perspective divide. Out in NDC, where the box spans -1..1.
        const turnedX = x * cos + z * sin
        const turnedZ = -x * sin + z * cos
        const depth = (camera.position.z - turnedZ) * tan
        const nx = turnedX / (depth * aspect)
        const ny = y / depth
        if (nx < minX) minX = nx
        if (nx > maxX) maxX = nx
        if (ny < minY) minY = ny
        if (ny > maxY) maxY = ny
      }
      const measured = {
        height: (maxY - minY) / 2,
        centreX: (1 + (minX + maxX) / 2) / 2,
        centreY: (1 - (minY + maxY) / 2) / 2,
      }
      silhouettes.set(key, measured)
      return measured
    }

    // The route. Re-read whenever layout can have moved: a resize, the body
    // changing height as fonts and images settle, the fonts themselves.
    let anchors: Anchor[] = []
    const box = { width: 0, height: 0 }
    const written = { transform: "", clip: "" }
    const plates = new Map<HTMLElement, number>()
    const measure = () => {
      silhouettes.clear()
      anchors = measureAnchors(silhouette(0))
      const home = anchors[0]
      const flight = flightRef.current
      if (!home || !flight) return
      // The flying box is the hero stage's size, so at home it is the stage.
      const rect = home.el.getBoundingClientRect()
      box.width = rect.width
      box.height = rect.height
      flight.style.width = `${rect.width}px`
      flight.style.height = `${rect.height}px`
      written.transform = ""
    }
    measure()
    window.addEventListener("resize", measure, { passive: true })
    const layout = new ResizeObserver(measure)
    layout.observe(document.body)
    void document.fonts?.ready.then(() => {
      if (!disposed) measure()
    })

    /** Hand every photo its own skull back, and stop offering this one for grabs. */
    const release = () => {
      for (const el of plates.keys()) el.style.removeProperty("--skull-dock")
      plates.clear()
      const i = getSkullInteraction()
      i.box = null
      i.hit = null
    }

    const onLost = (event: Event) => {
      event.preventDefault()
      failed = true
      release()
      errorRef.current(new Error("WebGL context lost"))
    }
    renderer.domElement.addEventListener("webglcontextlost", onLost)

    let bank = 0
    let lastCx = NaN
    /** The pose last submitted to the GPU, so an idle skull costs no draws. */
    const drawn = { x: NaN, y: NaN, z: NaN, lift: NaN, width: 0, height: 0 }
    /** The model's scaled width and depth, for the halo's silhouette width. */
    const extent = new Vector3()
    const haloPoint = new Vector3()
    const lastRot = { x: 0, y: 0 }
    let flare = 0
    // World units visible top to bottom at the pivot's depth - the yardstick
    // the halo radius is published against.
    const viewHeight = 2 * camera.position.z * Math.tan((camera.fov * Math.PI) / 360)

    const loop = () => {
      frame = requestAnimationFrame(loop)

      timer.update()
      // Timer already zeroes the delta for a hidden tab; this is the backstop
      // for an ordinary stalled frame - a long GC, or the first frame after the
      // model finishes decoding.
      const d = Math.min(timer.getDelta(), 0.05)
      const i = getSkullInteraction()
      const flight = flightRef.current
      const scroll = window.scrollY
      const vw = document.documentElement.clientWidth
      const vh = window.innerHeight
      const pose = journey(anchors, scroll, vw, vh)
      if (!pose || !flight || box.height === 0) return

      // Put the box where the route says the skull is, sized so the
      // silhouette at the dock's angle matches the photographed one. Scaled
      // about its top left, so the translate is simply where that corner lands.
      const shape = silhouette(pose.turn)
      const s = pose.h / (shape.height * box.height)
      const w = box.width * s
      const h = box.height * s
      const left = pose.cx - shape.centreX * w
      const top = pose.cy - shape.centreY * h
      const transform = `translate3d(${left.toFixed(2)}px, ${top.toFixed(2)}px, 0) scale(${s.toFixed(5)})`
      if (transform !== written.transform) {
        flight.style.transform = transform
        written.transform = transform
      }

      // The crop is an inset of the box, in its own unscaled pixels.
      const clip = pose.clip
        ? `inset(${[
            pose.clip.top - top,
            left + w - pose.clip.right,
            top + h - pose.clip.bottom,
            pose.clip.left - left,
          ]
            .map((v) => `${Math.max(0, v / s).toFixed(1)}px`)
            .join(" ")})`
        : "none"
      if (clip !== written.clip) {
        flight.style.clipPath = clip
        written.clip = clip
      }

      const visible = top - scroll < vh && top - scroll + h > 0
      const ready = model !== null && !failed

      if (ready) {
        for (const [el, weight] of pose.plates) {
          const was = plates.get(el) ?? 0
          if (Math.abs(weight - was) < 0.004 && !(weight === 0 && was !== 0)) continue
          plates.set(el, weight)
          el.style.setProperty("--skull-dock", weight.toFixed(3))
        }
        i.box = { x: left, y: top - scroll, w, h }
        i.hit = visible
          ? { x: pose.cx, y: pose.cy - scroll, rx: i.halo.r * h, ry: pose.h / 2 }
          : null
      }

      // The skull looks at the cursor from wherever it is, not from the middle
      // of the screen: docked on the left, a cursor to its right turns it right.
      if (i.cursor) {
        i.pointer.x = Math.max(-1, Math.min(1, (i.cursor.x - pose.cx) / (vw / 2)))
        i.pointer.y = Math.max(-1, Math.min(1, (i.cursor.y - (pose.cy - scroll)) / (vh / 2)))
      }

      if (!visible) return

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

      // Bank into sideways flight, and settle level again once it stops.
      if (d > 0 && Number.isFinite(lastCx)) {
        const lean = Math.max(-BANK_MAX, Math.min(BANK_MAX, (-(pose.cx - lastCx) / d) * BANK_GAIN))
        bank += (lean - bank) * t
      }
      lastCx = pose.cx

      pivot.rotation.x = follow.x + i.userRot.x
      pivot.rotation.y = MODEL_YAW_OFFSET + follow.y + i.userRot.y + pose.spin + pose.turn
      pivot.rotation.z = bank
      pivot.position.y =
        OPTICAL_CENTRE_LIFT + Math.sin(timer.getElapsed() * 0.55) * 0.045 * pose.bob

      const size = renderer.domElement
      if (
        Math.abs(pivot.rotation.x - drawn.x) > 1e-5 ||
        Math.abs(pivot.rotation.y - drawn.y) > 1e-5 ||
        Math.abs(pivot.rotation.z - drawn.z) > 1e-5 ||
        Math.abs(pivot.position.y - drawn.lift) > 1e-5 ||
        size.width !== drawn.width ||
        size.height !== drawn.height
      ) {
        renderer.render(scene, camera)
        drawn.x = pivot.rotation.x
        drawn.y = pivot.rotation.y
        drawn.z = pivot.rotation.z
        drawn.lift = pivot.position.y
        drawn.width = size.width
        drawn.height = size.height
      }

      if (model) {
        // Tell the headline where to burn. Taken after render so the camera's
        // matrices are current, and from the pose rather than the bob: the bob
        // never settles, and following it would repaint four layers of display
        // type every frame for a drift nobody would read as a response.
        haloPoint.set(0, HALO_CROWN, HALO_REACH).applyEuler(pivot.rotation)
        haloPoint.y += OPTICAL_CENTRE_LIFT
        haloPoint.project(camera)

        // The skull is deeper than it is wide, so its silhouette broadens as it
        // turns toward profile - and the burn broadens with it. Projected as an
        // ellipse, which a cranium is close to; the bounding box's own width
        // swells half as much again at 45° and burnt the whole line away.
        const yaw = pivot.rotation.y
        const halfWidth = Math.hypot(Math.cos(yaw) * extent.x, Math.sin(yaw) * extent.z) / 2

        // A flung skull flares the burn, which settles again as it slows.
        // Measured on the visitor's own turning, not the route's: the flight
        // spin is not something they did, and it wraps a full turn on landing.
        const ownPitch = follow.x + i.userRot.x
        const ownYaw = follow.y + i.userRot.y
        if (d > 0) {
          const spin = Math.hypot(ownPitch - lastRot.x, ownYaw - lastRot.y) / d
          flare += (Math.min(spin * HALO_FLARE_GAIN, HALO_FLARE_MAX) - flare) * t
        }
        lastRot.x = ownPitch
        lastRot.y = ownYaw

        i.halo.x = (haloPoint.x + 1) / 2
        i.halo.y = (1 - haloPoint.y) / 2
        i.halo.r = halfWidth / viewHeight
        i.halo.flare = flare
      }
    }

    // One retry, once, after a short pause. A dropped connection mid-download
    // otherwise strands the visitor on the poster for the rest of the session:
    // the loader has no recovery of its own and nothing else asks again. Two
    // attempts and then it stays on the poster, which is a finished hero
    // rather than a failure state, so there is nothing louder to do.
    let modelAttempt = 0
    let retryTimer = 0
    const loader = new GLTFLoader()
    // The mesh ships meshopt-compressed (EXT_meshopt_compression), which cut
    // it from 8.9 MB to 1 MB with the triangle count untouched. The decoder is
    // NOT optional: without it the loader rejects the file outright and the
    // hero never gets past its poster.
    loader.setMeshoptDecoder(MeshoptDecoder)
    const loadModel = () =>
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
        extent.copy(size).multiplyScalar(scale)
        lastRot.x = follow.x
        lastRot.y = follow.y
        model = scaled

        // Sample the surface into pivot space for the silhouette. About forty
        // thousand points pins the outline to well under a pixel, and a new
        // angle costs a fraction of a millisecond to measure.
        pivot.updateMatrixWorld(true)
        const toPivot = new Matrix4().copy(pivot.matrixWorld).invert()
        const points: number[] = []
        const point = new Vector3()
        root.traverse((child) => {
          const mesh = child as Mesh
          if (!mesh.isMesh) return
          const position = mesh.geometry.getAttribute("position")
          const toLocal = new Matrix4().multiplyMatrices(toPivot, mesh.matrixWorld)
          const step = Math.max(1, Math.floor(position.count / 40000))
          for (let k = 0; k < position.count; k += step) {
            point.fromBufferAttribute(position, k).applyMatrix4(toLocal)
            points.push(point.x, point.y, point.z)
          }
        })
        surface = Float32Array.from(points)
        // Home is placed by the silhouette too; now it is known exactly.
        measure()

        readyRef.current()
      },
      undefined,
      (reason) => {
        if (disposed) return
        // A dropped connection is the common failure here, not a bad file, so
        // it is worth asking once more before settling for the poster. After
        // that it stays on the poster, which is a finished hero rather than an
        // error state, so there is nothing louder to do.
        if (modelAttempt < 1) {
          modelAttempt += 1
          retryTimer = window.setTimeout(loadModel, 1200)
          return
        }
        errorRef.current(reason)
      },
    )

    loadModel()

    frame = requestAnimationFrame(loop)

    return () => {
      disposed = true
      window.clearTimeout(retryTimer)
      cancelAnimationFrame(frame)
      observer.disconnect()
      layout.disconnect()
      window.removeEventListener("resize", measure)
      renderer.domElement.removeEventListener("webglcontextlost", onLost)
      timer.dispose()
      // The poster takes over from here, and it sits in the rest pose.
      release()
      Object.assign(getSkullInteraction().halo, HALO_REST)

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
  }, [flightRef])

  return <div ref={hostRef} className="size-full" />
}

export default SkullCanvas
