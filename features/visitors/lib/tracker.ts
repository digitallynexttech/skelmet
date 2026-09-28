import { useCart, type CartLine } from "@/features/cart/hooks/use-cart"
import { useConsent, type Consent } from "@/features/visitors/hooks/use-consent"

/**
 * The storefront's visit tracker, browser half: the page views, the time
 * actually spent on each, the cart as it changes, and - for a visitor who
 * accepted cookies - what they type at checkout. The server half, and what it
 * keeps for whom, is features/visitors/server/tracking.service.ts.
 *
 * Browser-only: every export is called from an effect or an event handler.
 */

const ENDPOINT = "/api/public/visits"
const VISIT_KEY = "skm.visit"

/** Thirty minutes without a page ends a visit, as analytics tools count one. */
const VISIT_IDLE_MS = 30 * 60_000

/** Past this without a tap, a scroll or a key, the page is open but nobody is reading it. */
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

/**
 * This tab's visit. In sessionStorage, so it lasts as long as the tab and no
 * longer, and starts afresh after thirty idle minutes. Not a cookie: it is
 * never sent anywhere except inside these messages.
 */
function visitId(): string {
  const now = Date.now()
  let visit = visitInMemory
  try {
    const raw = sessionStorage.getItem(VISIT_KEY)
    if (raw) visit = JSON.parse(raw) as { id: string; at: number }
  } catch {
    // Storage blocked or unreadable: the copy in memory will do.
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

const granted = () => useConsent.getState().consent === "granted"

function post(body: string, beacon: boolean): Promise<unknown> {
  // A page that is closing cancels its fetches; a beacon outlives it. Sent as
  // text/plain, which every browser accepts for a beacon.
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

/**
 * One at a time, in order. The first answer to a visitor who accepted sets
 * their cookie, and a second message racing it would arrive without one and
 * make them a second visitor.
 */
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
    // Chrome on Android no longer says which phone it is, or which Android,
    // in its user agent. It still answers when asked.
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
        // Not offered; the user agent will have to do.
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

/** Adds the time since the last tick, if the page was in front of someone using it. */
function tick(visible = document.visibilityState === "visible"): void {
  const now = performance.now()
  if (visible && now - lastInput < IDLE_MS) engagedMs += now - lastTick
  lastTick = now
}

/** Reports the time spent on the current page since the last report. */
function flushTime(beacon: boolean): void {
  tick()
  const seconds = Math.floor(engagedMs / 1000)
  if (!page || seconds < 1) return
  engagedMs -= seconds * 1000
  send({ t: "time", pv: page.pv, s: Math.min(seconds, 1800) }, { sid: page.sid, beacon })
}

/** A page seen. Called on every route change, and on the first page. */
export function trackPage(path: string): void {
  // React runs a new effect twice in development; one page is one view.
  if (page && page.path === path && performance.now() - page.at < 1000) return

  flushTime(false)
  const sid = visitId()
  const pv = uuid()
  const now = performance.now()
  page = { pv, sid, path, at: now }
  engagedMs = 0
  lastTick = now
  lastInput = now

  // Where they came from means something only on the first page after the
  // site is opened; after that, it is still the same outside referrer.
  const ref = firstView && document.referrer ? document.referrer.slice(0, 1000) : undefined
  firstView = false

  enqueue(async () => {
    const all = await device()
    // The phone model only for a visitor who accepted: together with the
    // rest it narrows one device down a long way.
    const { model, ...coarse } = all
    const facts = granted() && model ? { ...coarse, model } : coarse
    return post(
      JSON.stringify({ t: "view", pv, path, ref, device: facts, sid, consent: granted() }),
      false,
    )
  })
}

/** Starts counting time on page. Returns the cleanup. */
export function startEngagement(): () => void {
  const onInput = () => {
    tick()
    lastInput = performance.now()
  }
  const onVisibility = () => {
    if (document.visibilityState === "hidden") {
      // The stretch up to now was in front of them; the change has already
      // happened by the time this runs.
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

/**
 * Copies the cart to the server as it changes. Not on load: the cart coming
 * back out of localStorage is not the visitor doing anything.
 */
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

/** The basket that reached checkout: the cart, or the one line Buy it now sends. */
export function reportCheckout(items: CartLine[]): void {
  if (items.length === 0) return
  send({ t: "cart", items: lines(items), checkout: true })
}

/**
 * Details typed at checkout, before any order exists. Only for a visitor who
 * accepted cookies - it is what lets the shop follow up on a checkout left
 * half-way, and nobody who refused has agreed to that.
 */
export function reportContact(details: {
  email?: string
  phone?: string
  name?: string
  pincode?: string
}): void {
  if (!granted()) return
  send({ t: "contact", ...details })
}

/** The basket became an order. */
export function reportPlaced(number: string): void {
  send({ t: "placed", number })
}

/**
 * A choice on the cookie bar. Accepting tells the server to start
 * recognising this device; refusing after having accepted tells it to forget
 * the device. Refusing from the start needs no message at all.
 */
export function reportConsent(next: "granted" | "denied", previous: Consent): void {
  if (next === "granted" || previous === "granted") send({ t: "consent" })
}
