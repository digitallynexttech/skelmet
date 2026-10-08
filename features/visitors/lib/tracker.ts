import { useCart, type CartLine } from "@/features/cart/hooks/use-cart"
import { useConsent, type Consent } from "@/features/visitors/hooks/use-consent"

// Browser half of the visit tracker; what is kept for whom is in server/tracking.service.ts.
// Browser-only.

const ENDPOINT = "/api/public/visits"
const VISIT_KEY = "skm.visit"

/** Idle time that ends a visit, as analytics tools count one. */
const VISIT_IDLE_MS = 30 * 60_000

/** No tap, scroll or key for this long: nobody is reading. */
const IDLE_MS = 30_000

type Message = { t: string } & Record<string, unknown>

function uuid(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID()
  // randomUUID needs a secure origin; getRandomValues does not.
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6]! & 0x0f) | 0x40
  b[8] = (b[8]! & 0x3f) | 0x80
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("")
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

let visitInMemory: { id: string; at: number } | null = null

// Per tab, in sessionStorage. Deliberately not a cookie: sent only inside these messages.
function visitId(): string {
  const now = Date.now()
  let visit = visitInMemory
  try {
    const raw = sessionStorage.getItem(VISIT_KEY)
    if (raw) visit = JSON.parse(raw) as { id: string; at: number }
  } catch {
    // Storage blocked: the copy in memory will do.
  }
  if (!visit || typeof visit.id !== "string" || now - Number(visit.at) > VISIT_IDLE_MS) {
    visit = { id: uuid(), at: now }
  }
  visit = { id: visit.id, at: now }
  visitInMemory = visit
  try {
    sessionStorage.setItem(VISIT_KEY, JSON.stringify(visit))
  } catch {
    // As above.
  }
  return visit.id
}

const granted = () => useConsent.getState().consent !== "denied"

function post(body: string, beacon: boolean): Promise<unknown> {
  // A beacon outlives a closing page; text/plain is the type every browser accepts for one.
  if (beacon && typeof navigator.sendBeacon === "function") {
    if (navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "text/plain" }))) {
      return Promise.resolve()
    }
  }
  return fetch(ENDPOINT, {
    method: "POST",
    body,
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    keepalive: true,
  }).catch(() => undefined)
}

// Strictly in order: the first answer sets the cookie, and a racing message would make a
// second visitor.
let queue: Promise<unknown> = Promise.resolve()

function enqueue(work: () => Promise<unknown>): void {
  queue = queue.then(work).catch(() => undefined)
}

function send(message: Message, options: { sid?: string; beacon?: boolean } = {}): void {
  const body = () =>
    JSON.stringify({ ...message, sid: options.sid ?? visitId(), consent: granted() })
  if (options.beacon) {
    void post(body(), true)
    return
  }
  enqueue(() => post(body(), false))
}

type Device = {
  screen?: string
  lang?: string
  tz?: string
  touch?: number
  model?: string
  platformVersion?: string
}

type UserAgentData = {
  getHighEntropyValues(hints: string[]): Promise<{ model?: string; platformVersion?: string }>
}

let deviceOnce: Promise<Device> | null = null

function device(): Promise<Device> {
  deviceOnce ??= (async () => {
    const found: Device = {
      screen: `${window.screen.width}x${window.screen.height}`,
      lang: navigator.language?.slice(0, 35),
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone?.slice(0, 60),
      touch: Math.min(32, navigator.maxTouchPoints ?? 0),
    }
    // Chrome on Android leaves the model and version out of its user agent, but answers this.
    const uaData = (navigator as Navigator & { userAgentData?: UserAgentData }).userAgentData
    if (uaData) {
      try {
        const high = await Promise.race([
          uaData.getHighEntropyValues(["model", "platformVersion"]),
          new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 500)),
        ])
        if (high?.model) found.model = high.model.slice(0, 60)
        if (high?.platformVersion) found.platformVersion = high.platformVersion.slice(0, 30)
      } catch {
        // Not offered: the user agent will do.
      }
    }
    return found
  })()
  return deviceOnce
}

// ── time on page ──────────────────────────────────────────
let page: { pv: string; sid: string; path: string; at: number } | null = null
let engagedMs = 0
let lastTick = 0
let lastInput = 0
let firstView = true

function tick(visible = document.visibilityState === "visible"): void {
  const now = performance.now()
  if (visible && now - lastInput < IDLE_MS) engagedMs += now - lastTick
  lastTick = now
}

function flushTime(beacon: boolean): void {
  tick()
  const seconds = Math.floor(engagedMs / 1000)
  if (!page || seconds < 1) return
  engagedMs -= seconds * 1000
  send({ t: "time", pv: page.pv, s: Math.min(seconds, 1800) }, { sid: page.sid, beacon })
}

/** Called on the first page and every route change. */
export function trackPage(path: string): void {
  // React runs a new effect twice in development.
  if (page && page.path === path && performance.now() - page.at < 1000) return

  flushTime(false)
  const sid = visitId()
  const pv = uuid()
  const now = performance.now()
  page = { pv, sid, path, at: now }
  engagedMs = 0
  lastTick = now
  lastInput = now

  // The referrer means something only on the first page.
  const ref = firstView && document.referrer ? document.referrer.slice(0, 1000) : undefined
  firstView = false

  enqueue(async () => {
    const all = await device()
    // Privacy: the phone model only with consent; it narrows one device down a long way.
    const { model, ...coarse } = all
    const facts = granted() && model ? { ...coarse, model } : coarse
    return post(
      JSON.stringify({ t: "view", pv, path, ref, device: facts, sid, consent: granted() }),
      false,
    )
  })
}

/** Counts time on page. Returns the cleanup. */
export function startEngagement(): () => void {
  const onInput = () => {
    tick()
    lastInput = performance.now()
  }
  const onVisibility = () => {
    if (document.visibilityState === "hidden") {
      // Already hidden when this runs, but the time up to now was visible.
      tick(true)
      flushTime(true)
    } else {
      lastTick = performance.now()
      lastInput = lastTick
    }
  }
  const onHide = () => flushTime(true)

  const timer = window.setInterval(() => tick(), 5000)
  const events = ["pointerdown", "pointermove", "keydown", "scroll", "wheel", "touchstart"]
  for (const name of events) window.addEventListener(name, onInput, { passive: true })
  document.addEventListener("visibilitychange", onVisibility)
  window.addEventListener("pagehide", onHide)

  return () => {
    window.clearInterval(timer)
    for (const name of events) window.removeEventListener(name, onInput)
    document.removeEventListener("visibilitychange", onVisibility)
    window.removeEventListener("pagehide", onHide)
  }
}

// ── the cart ──────────────────────────────────────────────
const lines = (items: CartLine[]) => items.map((l) => ({ sku: l.sku, qty: l.qty }))
const signature = (items: CartLine[]) =>
  items
    .map((l) => `${l.sku}:${l.qty}`)
    .sort()
    .join(",")

/** Copies the cart to the server as it changes; not the cart restored from storage on load. */
export function watchCart(): () => void {
  let last: string | null = null
  let timer: number | undefined
  const baseline = () => {
    last = signature(useCart.getState().items)
  }
  if (useCart.persist.hasHydrated()) baseline()
  const stopHydration = useCart.persist.onFinishHydration(baseline)

  const stopWatching = useCart.subscribe((state) => {
    if (last === null) return
    const next = signature(state.items)
    if (next === last) return
    last = next
    // A run of + taps is one change, not five.
    window.clearTimeout(timer)
    timer = window.setTimeout(
      () => send({ t: "cart", items: lines(useCart.getState().items) }),
      1200,
    )
  })

  return () => {
    window.clearTimeout(timer)
    stopWatching()
    stopHydration()
  }
}

/** The cart, or the one line Buy it now sends. */
export function reportCheckout(items: CartLine[]): void {
  if (items.length === 0) return
  send({ t: "cart", items: lines(items), checkout: true })
}

/** Details typed at checkout, before any order. Only with consent. */
export function reportContact(details: {
  email?: string
  phone?: string
  name?: string
  pincode?: string
}): void {
  if (!granted()) return
  send({ t: "contact", ...details })
}

export function reportPlaced(number: string): void {
  send({ t: "placed", number })
}

/** Accepting starts recognising the device; refusing after accepting forgets it. */
export function reportConsent(next: "granted" | "denied", previous: Consent): void {
  if (next === "granted" || previous === "granted") send({ t: "consent" })
}
