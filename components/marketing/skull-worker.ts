import {
  createSkullScene,
  type SkullModelInfo,
  type SkullPose,
  type SkullScene,
} from "@/components/marketing/skull-scene"

/**
 * The hero skull's scene off the main thread: skull-renderer transfers it a
 * canvas, then only sends poses; three.js, the model and every draw stay here.
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

// DOM and worker globals do not share a tsconfig; just the worker parts used here.
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
