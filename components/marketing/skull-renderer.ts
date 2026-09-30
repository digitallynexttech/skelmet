import { SKULL_MODEL } from "@/components/marketing/skull-interaction"
import type { SkullModelInfo, SkullPose, SkullScene } from "@/components/marketing/skull-scene"
import type { FromSkullWorker, ToSkullWorker } from "@/components/marketing/skull-worker"

/**
 * The hero skull's renderer, as the page sees it: a canvas to put somewhere,
 * and a way to say how the skull is turned.
 *
 * One of these for the life of the page, however many times the hero mounts.
 * It owns three things the visitor should only ever wait for once:
 *
 *   - The model's bytes. Kept in the browser's Cache Storage under the file's
 *     own (hashed) name, so a return visit reads them off disk without a
 *     request - and, unlike the HTTP cache, can be asked whether it has them.
 *   - The scene (skull-scene): three.js, the decoded mesh, compiled shaders.
 *     In a worker, on a canvas handed over to it, wherever the browser allows;
 *     on this thread otherwise.
 *   - The canvas element. Leaving the home page takes it off the page, not
 *     apart: coming back puts the same canvas, still holding the skull, back
 *     in the hero, with nothing to load, decode or compile.
 */

/** The Cache Storage bucket the model is kept in. */
const STORE = "skelmet-skull"

type Listener = {
  /** The skull is drawn on the canvas. Again, at once, on a later mount. */
  onReady: (info: SkullModelInfo) => void
  /** No skull: no WebGL, the file would not come, or the context was lost. */
  onFailed: (reason: unknown) => void
}

/** What a mounted hero holds. */
export type SkullHandle = {
  /** The canvas's size on the page, CSS px. */
  size: (width: number, height: number) => void
  pose: (pose: SkullPose) => void
  /** When the poster's bob began, in performance.now() milliseconds. */
  clock: (bobEpoch: number) => void
  /** Whether any of the canvas is on screen. */
  visible: (visible: boolean) => void
  unmount: () => void
}

type Renderer = {
  canvas: HTMLCanvasElement
  /** Delivers to the scene, whichever thread it is on. Null until it exists. */
  deliver: ((message: ToSkullWorker) => void) | null
  /**
   * The latest of each kind of message. A scene that starts late - or starts
   * over on the other thread - is told all of it, so nothing said while there
   * was nobody to hear is lost.
   */
  latest: Map<ToSkullWorker["type"], ToSkullWorker>
  info: SkullModelInfo | null
  listener: Listener | null
  stop: () => void
}

let renderer: Renderer | null = null

/** Can the scene run in a worker here. Still only a promise: the worker may be refused a context. */
export function rendersOffThread(): boolean {
  return (
    typeof Worker === "function" &&
    typeof OffscreenCanvas === "function" &&
    typeof HTMLCanvasElement.prototype.transferControlToOffscreen === "function"
  )
}

/** The skull has been on screen in this page's lifetime, and its canvas is still good. */
export function skullWarm(): boolean {
  return renderer?.info != null
}

async function openStore(): Promise<Cache | null> {
  try {
    // Absent outside a secure context, and refused in some private windows.
    return typeof caches === "undefined" ? null : await caches.open(STORE)
  } catch {
    return null
  }
}

/**
 * Whether this browser already holds the model, asked without touching the
 * network. Where there is no Cache Storage, the HTTP cache is asked instead:
 * `only-if-cached` answers from it or not at all, and a browser without that
 * mode rejects it, which reads as no.
 */
export async function modelStored(): Promise<boolean> {
  const store = await openStore()
  if (store) {
    try {
      return (await store.match(SKULL_MODEL)) !== undefined
    } catch {
      return false
    }
  }
  try {
    const response = await fetch(SKULL_MODEL, { cache: "only-if-cached", mode: "same-origin" })
    response.body?.cancel().catch(() => {})
    return response.ok
  } catch {
    return false
  }
}

async function download(): Promise<Response> {
  const response = await fetch(SKULL_MODEL)
  if (!response.ok) throw new Error(`The model answered ${response.status}`)
  return response
}

/** The model file, from the store if it is there, else downloaded and put there. */
async function modelBytes(): Promise<ArrayBuffer> {
  const store = await openStore()
  const kept = await store?.match(SKULL_MODEL).catch(() => undefined)
  if (kept) return kept.arrayBuffer()

  // One retry, once, after a short pause. A dropped connection mid-download
  // otherwise strands the visitor on the poster for the rest of the session.
  // Two attempts and then it stays on the poster, which is a finished hero
  // rather than a failure state, so there is nothing louder to do.
  const response = await download().catch(
    () =>
      new Promise<Response>((resolve, reject) =>
        setTimeout(() => download().then(resolve, reject), 1200),
      ),
  )
  if (store) {
    // A rebuilt model has a new name; the old one's megabyte goes.
    void store
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => new URL(k.url).pathname !== SKULL_MODEL).map((k) => store.delete(k)),
        ),
      )
      .catch(() => {})
    void store.put(SKULL_MODEL, response.clone()).catch(() => {})
  }
  return response.arrayBuffer()
}

function newCanvas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas")
  canvas.style.cssText = "display:block;width:100%;height:100%"
  return canvas
}

function start(): Renderer {
  const r: Renderer = {
    canvas: newCanvas(),
    deliver: null,
    latest: new Map(),
    info: null,
    listener: null,
    stop: () => {},
  }
  const touch = window.matchMedia("(pointer: coarse)").matches
  const devicePixelRatio = window.devicePixelRatio

  const fail = (reason: unknown) => {
    if (renderer === r) renderer = null
    r.stop()
    r.canvas.remove()
    r.info = null
    r.listener?.onFailed(reason)
  }
  const ready = (info: SkullModelInfo) => {
    r.info = info
    r.listener?.onReady(info)
  }
  /** The scene exists: it gets what has been said so far. */
  const open = (deliver: (message: ToSkullWorker) => void) => {
    r.deliver = deliver
    for (const message of r.latest.values()) deliver(message)
  }
  const sizeNow = () => {
    const said = r.latest.get("size")
    return said?.type === "size"
      ? { width: said.width, height: said.height }
      : { width: 0, height: 0 }
  }

  /** The scene on this thread, with three.js loaded onto it. */
  const local = () => {
    let scene: SkullScene | null = null
    let stopped = false
    r.stop = () => {
      stopped = true
      scene?.dispose()
    }
    Promise.all([import("@/components/marketing/skull-scene"), modelBytes()]).then(
      ([{ createSkullScene }, model]) => {
        if (stopped) return
        scene = createSkullScene(
          { canvas: r.canvas, model, touch, devicePixelRatio, ...sizeNow(), hull: false },
          { onReady: ready, onLost: () => fail(new Error("WebGL context lost")), onError: fail },
        )
        if (!scene) return
        const running = scene
        open((message) => {
          if (message.type === "size") running.resize(message.width, message.height)
          else if (message.type === "pose") running.pose(message.pose)
          else if (message.type === "clock") running.clock(message.bobStart)
          else if (message.type === "visible") running.visible(message.visible)
        })
      },
      fail,
    )
  }

  if (!rendersOffThread()) {
    local()
    return r
  }

  let worker: Worker
  try {
    // A relative path in so many words: the bundler finds the worker's code by
    // reading this line.
    worker = new Worker(new URL("./skull-worker.ts", import.meta.url))
  } catch {
    local()
    return r
  }
  const offscreen = r.canvas.transferControlToOffscreen()
  r.stop = () => worker.terminate()
  const post = (message: ToSkullWorker, transfer: Transferable[] = []) =>
    worker.postMessage(message, transfer)

  /**
   * A worker that cannot have WebGL (Safari before 17), or whose script never
   * arrived. The canvas handed to it is spent - control does not come back -
   * so the scene starts over on this thread with a canvas of its own, in the
   * old one's place.
   */
  let abandoned = false
  const onThisThreadInstead = () => {
    abandoned = true
    worker.terminate()
    const spent = r.canvas
    r.canvas = newCanvas()
    spent.replaceWith(r.canvas)
    r.deliver = null
    local()
  }
  worker.onmessage = (event: MessageEvent<FromSkullWorker>) => {
    const message = event.data
    if (message.type === "ready") ready({ surface: message.surface, extent: message.extent })
    else if (message.type === "lost") fail(new Error("WebGL context lost"))
    else if (r.info) fail(new Error(message.message))
    else onThisThreadInstead()
  }
  worker.onerror = (event) => {
    event.preventDefault()
    if (r.info) fail(new Error(event.message))
    else onThisThreadInstead()
  }

  // The worker's script and the model download side by side; the scene starts
  // when both are in.
  modelBytes().then((model) => {
    if (renderer !== r || abandoned) return
    post({ type: "init", canvas: offscreen, model, touch, devicePixelRatio, ...sizeNow() }, [
      offscreen,
      model,
    ])
    open(post)
  }, fail)

  return r
}

/**
 * Put the skull's canvas in `host` and start the renderer if this is the first
 * time. `onReady` fires once the skull is drawn - straight away if it already
 * was.
 */
export function mountSkull(host: HTMLElement, listener: Listener): SkullHandle {
  const r = (renderer ??= start())
  r.listener = listener
  host.appendChild(r.canvas)

  const say = (message: ToSkullWorker) => {
    r.latest.set(message.type, message)
    r.deliver?.(message)
  }
  say({ type: "visible", visible: true })
  if (r.info) {
    const info = r.info
    queueMicrotask(() => {
      if (r.listener === listener) listener.onReady(info)
    })
  }

  return {
    size: (width, height) => say({ type: "size", width, height }),
    pose: (pose) => say({ type: "pose", pose }),
    // The poster's animation is timed from this document's start; the scene's
    // clock, which may be another thread's, is the wall's.
    clock: (bobEpoch) => say({ type: "clock", bobStart: performance.timeOrigin + bobEpoch }),
    visible: (visible) => say({ type: "visible", visible }),
    unmount: () => {
      if (r.listener !== listener) return
      r.listener = null
      r.canvas.remove()
      say({ type: "visible", visible: false })
    },
  }
}
