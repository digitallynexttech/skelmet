/**
 * Runs `run` once the visitor first does something - moves the pointer,
 * touches, scrolls or presses a key - and at once if they already have.
 *
 * For work the first screen does not need: the 3D skull (a large download
 * and a second of main-thread work on a phone) and Google Analytics'
 * library. Doing it at load competed with the page for the network and the
 * main thread while it was still becoming usable; waiting for the first sign
 * of a person puts it after that, and on a desktop a mouse moves within the
 * first second anyway.
 *
 * Returns a function that cancels a run still waiting.
 */

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
