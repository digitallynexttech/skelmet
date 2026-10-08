import { SKULL_MODEL } from "@/components/marketing/skull-interaction"
import type { SkullModelInfo, SkullPose, SkullScene } from "@/components/marketing/skull-scene"
import type { FromSkullWorker, ToSkullWorker } from "@/components/marketing/skull-worker"

/**
 * The hero skull's renderer: one per page lifetime, however often the hero
 * mounts. It keeps the model bytes (Cache Storage, which unlike the HTTP cache
 * can be asked), the scene (in a worker where allowed) and the canvas, so a
 * return to the home page reuses all three with nothing to load or compile.
 */

/** The Cache Storage bucket the model is kept in. */
const STORE = "skelmet-skull"

type Listener = {
  /** The skull is drawn; fires at once on a later mount. */
  onReady: (info: SkullModelInfo) => void
  /** No skull: no WebGL, the file would not come, or the context was lost. */
  onFailed: (reason: unknown) => void
}

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
  /** The latest message of each kind, replayed to a scene that starts late or restarts. */
  latest: Map<ToSkullWorker["type"], ToSkullWorker>
  info: SkullModelInfo | null
  listener: Listener | null
  stop: () => void
}

let renderer: Renderer | null = null

/** Whether a worker can take the canvas. It may still be refused a WebGL context. */
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
 * Whether the model is already held, without touching the network. Without Cache
 * Storage, asks the HTTP cache via `only-if-cached`; a rejection reads as no.
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

  // One retry after a short pause; after that the poster stays, which is a finished hero.
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

  /** The scene on the main thread. */
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
    // A literal relative path: the bundler finds the worker by reading this line.
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
   * The worker cannot have WebGL (Safari before 17) or its script failed. The
   * transferred canvas is spent, so the scene restarts here on a fresh one.
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

  // The worker's script and the model download in parallel.
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

/** Put the skull's canvas in `host`, starting the renderer the first time. */
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
    // The poster's epoch is document-relative; the scene, maybe in a worker, uses wall time.
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
