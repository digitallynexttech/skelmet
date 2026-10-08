const EVENTS = ["pointermove", "pointerdown", "touchstart", "scroll", "wheel", "keydown"] as const

let interacted = false
const waiting = new Set<() => void>()

function onInteraction() {
  if (interacted) return
  interacted = true
  for (const type of EVENTS) window.removeEventListener(type, onInteraction, true)
  const queued = [...waiting]
  waiting.clear()
  for (const run of queued) run()
}

let listening = false
function listen() {
  if (listening) return
  listening = true
  for (const type of EVENTS) {
    window.addEventListener(type, onInteraction, { capture: true, passive: true })
  }
}

/**
 * Runs `run` on the first pointer, touch, scroll or key (at once if already),
 * so heavy extras stay off the page while it loads. Returns a cancel.
 */
export function afterFirstInteraction(run: () => void): () => void {
  if (typeof window === "undefined") return () => {}
  if (interacted) {
    run()
    return () => {}
  }
  listen()
  waiting.add(run)
  return () => {
    waiting.delete(run)
  }
}
