import { siteConfig } from "@/config/site"
import { useCart, type CartLine } from "@/features/cart/hooks/use-cart"
import { acceptedNow, useConsent } from "@/features/visitors/hooks/use-consent"

// Meta Pixel, production only, browser-only. Runs on a current Accept or before any
// choice (acceptedNow). No <noscript> image: a browser without JavaScript never sees the card.

type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void
  queue: ArrayLike<unknown>[]
  push: Fbq
  loaded: boolean
  version: string
}

declare global {
  interface Window {
    fbq?: Fbq
    _fbq?: Fbq
  }
}

const SCRIPT = "https://connect.facebook.net/en_US/fbevents.js"
/** Order numbers whose Purchase was already reported, newest first. */
const PURCHASES_KEY = "skm.pixel.purchases"

const enabled = () => process.env.NODE_ENV === "production" && Boolean(siteConfig.metaPixelId)
// An Accept given before it covered the pixel does not turn it on.
const granted = () => acceptedNow(useConsent.getState())

let installed = false
let revoked = false

/** Meta's base code, run on the first event with consent. Returns whether the pixel runs. */
function install(): boolean {
  // Checked on every event: an Accept can be taken back.
  if (typeof window === "undefined" || !enabled() || !granted()) return false
  if (installed) return true
  if (!window.fbq) {
    const fbq = function (...args: unknown[]) {
      if (fbq.callMethod) fbq.callMethod(...args)
      else fbq.queue.push(args)
    } as Fbq
    window.fbq = fbq
    if (!window._fbq) window._fbq = fbq
    fbq.push = fbq
    fbq.loaded = true
    fbq.version = "2.0"
    fbq.queue = []
    // Meta's script reports route-change PageViews itself and drops ours, so it is left to.
    const script = document.createElement("script")
    script.async = true
    script.src = SCRIPT
    document.head.appendChild(script)
  }
  // autoConfig off, before init: the privacy policy promises the pixel never sees
  // what is typed at checkout, whatever Events Manager has switched on.
  window.fbq("set", "autoConfig", false, siteConfig.metaPixelId)
  window.fbq("init", siteConfig.metaPixelId)
  installed = true
  return true
}

function track(event: string, params?: Record<string, unknown>, eventId?: string): void {
  if (!install()) return
  if (eventId) window.fbq?.("track", event, params ?? {}, { eventID: eventId })
  else if (params) window.fbq?.("track", event, params)
  else window.fbq?.("track", event)
}

type Line = { sku: string; qty: number; unitPrice: string | number }

/** Content ids are SKUs; value is in rupees. */
export function contentsOf(lines: Line[]) {
  const value = lines.reduce((sum, l) => sum + Number(l.unitPrice) * l.qty, 0)
  return {
    content_ids: lines.map((l) => l.sku),
    contents: lines.map((l) => ({ id: l.sku, quantity: l.qty })),
    content_type: "product",
    num_items: lines.reduce((n, l) => n + l.qty, 0),
    value: Math.round(value * 100) / 100,
    currency: "INR",
  }
}

export function pixelPageView(): void {
  track("PageView")
}

export function pixelViewContent(product: { sku: string; name: string; price: string }): void {
  track("ViewContent", {
    content_ids: [product.sku],
    content_name: product.name,
    content_type: "product",
    value: Number(product.price),
    currency: "INR",
  })
}

export function pixelInitiateCheckout(lines: Line[]): void {
  if (lines.length === 0) return
  track("InitiateCheckout", contentsOf(lines))
}

/** A Next drop list sign-up. */
export function pixelLead(name: string): void {
  track("Lead", { content_name: name })
}

function reportedPurchases(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(PURCHASES_KEY) ?? "[]") as unknown
    return Array.isArray(raw) ? raw.filter((n): n is string => typeof n === "string") : []
  } catch {
    return []
  }
}

/** Once per order per browser: the confirmation page can be reloaded or reopened. */
export function pixelPurchase(order: { number: string; total: string; items: Line[] }): void {
  if (!enabled() || !granted()) return
  const reported = reportedPurchases()
  if (reported.includes(order.number)) return
  track(
    "Purchase",
    { ...contentsOf(order.items), value: Number(order.total) },
    `purchase-${order.number}`,
  )
  try {
    localStorage.setItem(PURCHASES_KEY, JSON.stringify([order.number, ...reported].slice(0, 20)))
  } catch {
    // Storage blocked: a reload could report it again, nothing worse.
  }
}

/** One AddToCart per change that adds. Not for the cart restored from storage on load. */
export function watchCartForPixel(): () => void {
  let last: Map<string, number> | null = null
  const snapshot = (items: CartLine[]) => new Map(items.map((l) => [l.sku, l.qty]))
  const baseline = () => {
    last = snapshot(useCart.getState().items)
  }
  if (useCart.persist.hasHydrated()) baseline()
  const stopHydration = useCart.persist.onFinishHydration(baseline)

  const stopWatching = useCart.subscribe((state) => {
    if (last === null) return
    const before = last
    last = snapshot(state.items)
    const added = state.items
      .filter((l) => l.qty > (before.get(l.sku) ?? 0))
      .map((l) => ({ sku: l.sku, qty: l.qty - (before.get(l.sku) ?? 0), unitPrice: l.unitPrice }))
    if (added.length > 0) track("AddToCart", contentsOf(added))
  })

  return () => {
    stopWatching()
    stopHydration()
  }
}

// On this host and every parent domain, wherever Meta may have set them.
function forgetCookies(): void {
  const parts = location.hostname.split(".")
  const domains = [""]
  for (let i = 0; i < parts.length - 1; i++) domains.push(`; domain=.${parts.slice(i).join(".")}`)
  for (const name of ["_fbp", "_fbc"]) {
    for (const domain of domains) document.cookie = `${name}=; Max-Age=0; path=/${domain}`
  }
}

// Meta queues events while revoked and sends them all on grant. Drop those
// (route-change PageViews after Decline) so a later Accept does not hand them over.
function forgetHeldEvents(queue: ArrayLike<unknown>[]): void {
  let from = 0
  queue.forEach((call, i) => {
    if (call[0] === "consent" && call[1] === "revoke") from = i + 1
  })
  queue.splice(from)
}

/** A change of mind while the pixel runs: revoke deletes its cookies, a new Accept resumes it. */
export function pixelConsent(accepted: boolean): void {
  if (!installed || !window.fbq) return
  if (!accepted) {
    window.fbq("consent", "revoke")
    revoked = true
    forgetCookies()
    return
  }
  if (!revoked) return
  forgetHeldEvents(window.fbq.queue)
  window.fbq("consent", "grant")
  revoked = false
}
