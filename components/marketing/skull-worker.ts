import {
  createSkullScene,
  type SkullModelInfo,
  type SkullPose,
  type SkullScene,
} from "@/components/marketing/skull-scene"

/**
 * The hero skull's scene, run off the main thread. skull-renderer starts this
 * worker, hands it a canvas it has given up control of, and from then on only
 * tells it how the skull is turned; three.js, the model and every draw stay
 * on this side.
 */

/** What skull-renderer sends. */
export type ToSkullWorker =
  | {
      type: "init"
      canvas: OffscreenCanvas
      model: ArrayBuffer
      touch: boolean
      devicePixelRatio: number
      width: number
      height: number
    }
  | { type: "size"; width: number; height: number }
  | { type: "pose"; pose: SkullPose }
  | { type: "clock"; bobStart: number }
  | { type: "visible"; visible: boolean }
  | { type: "dispose" }

/** What it hears back. */
export type FromSkullWorker =
  ({ type: "ready" } & SkullModelInfo) | { type: "lost" } | { type: "error"; message: string }

// The DOM's and a worker's global types do not share a tsconfig; this is the
// little of the worker's that is used.
const scope = self as unknown as {
  postMessage: (message: FromSkullWorker, transfer?: Transferable[]) => void
  onmessage: ((event: MessageEvent<ToSkullWorker>) => void) | null
  close: () => void
}

let scene: SkullScene | null = null

scope.onmessage = (event) => {
  const message = event.data
  switch (message.type) {
    case "init":
      scene = createSkullScene(
        { ...message, hull: true },
        {
          onReady: (info) => scope.postMessage({ type: "ready", ...info }, [info.surface.buffer]),
          onLost: () => scope.postMessage({ type: "lost" }),
          onError: (text) => scope.postMessage({ type: "error", message: text }),
        },
      )
      break
    case "size":
      scene?.resize(message.width, message.height)
      break
    case "pose":
      scene?.pose(message.pose)
      break
    case "clock":
      scene?.clock(message.bobStart)
      break
    case "visible":
      scene?.visible(message.visible)
      break
    case "dispose":
      scene?.dispose()
      scene = null
      scope.close()
      break
  }
}
