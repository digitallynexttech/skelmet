import { siteConfig } from "@/config/site"
import { useCart, type CartLine } from "@/features/cart/hooks/use-cart"
import { acceptedNow, useConsent } from "@/features/visitors/hooks/use-consent"

/**
 * Meta Pixel - the Facebook and Instagram ads tag - for visitors who accepted
 * cookies, and nobody else.
 *
 * As with Microsoft Clarity, nothing of Meta's loads until Accept: no script,
 * no request, no _fbp cookie. Meta's base code ends with a <noscript> image
 * that reports a page view without JavaScript; it is left out, because a
 * browser without JavaScript can never have answered the cookie card. Taking
 * an Accept back revokes the pixel for the rest of the page and deletes its
 * cookies, and it does not load on the next.
 *
 * Production builds only, like the other tags: a laptop running `pnpm dev` is
 * not a visitor, and an ad account fed its clicks would optimise for them.
 *
 * Meta's standard events, so ads can optimise for them with no setup in
 * Events Manager: PageView on every page (the first from here, the rest from
 * Meta's own script, which follows the route changes - see install), ViewContent on the product page,
 * AddToCart, InitiateCheckout, Purchase (once per order) and Lead (the Next
 * drop list). Amounts are rupees; content ids are SKUs.
 *
 * Browser-only: every export is called from an effect or an event handler.
 */

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
/** Orders whose Purchase this browser has already reported, newest first. */
const PURCHASES_KEY = "skm.pixel.purchases"

const enabled = () => process.env.NODE_ENV === "production" && Boolean(siteConfig.metaPixelId)
// An Accept given before it covered the pixel does not turn it on.
const granted = () => acceptedNow(useConsent.getState())

let installed = false
/** Accept taken back on this page while the pixel was running. */
let revoked = false

/**
 * Meta's base code, as a function, run the first time anything is reported
 * with consent. Returns whether the pixel is running.
 */
function install(): boolean {
  // Asked on every event, not once: an Accept can be taken back.
  if (typeof window === "undefined" || !enabled() || !granted()) return false
  if (installed) return true
  if (!window.fbq) {
    // The queue Meta's script empties when it arrives.
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
    // Left on: Meta's script reports each route change itself, from
    // history.pushState. It keeps one PageView per page load from anyone else,
    // so the site cannot report them.
    const script = document.createElement("script")
    script.async = true
    script.src = SCRIPT
    document.head.appendChild(script)
  }
  // Meta's automatic setup off: it reports button presses with their text,
  // reads page markup, and can pick up what is typed into a form. The privacy
  // policy promises the pixel does not see what is typed at checkout, and that
  // holds whatever is switched on in Events Manager. Before init, as Meta asks.
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

/** Meta's product parameters for some lines: ids, quantities, value in rupees. */
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

/** The page on screen. */
export function pixelPageView(): void {
  track("PageView")
}

/** The product page. */
export function pixelViewContent(product: { sku: string; name: string; price: string }): void {
  track("ViewContent", {
    content_ids: [product.sku],
    content_name: product.name,
    content_type: "product",
    value: Number(product.price),
    currency: "INR",
  })
}

/** The basket that reached checkout: the cart, or the one line Buy it now sends. */
export function pixelInitiateCheckout(lines: Line[]): void {
  if (lines.length === 0) return
  track("InitiateCheckout", contentsOf(lines))
}

/** A sign-up: the Next drop list. */
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

/**
 * An order placed, from its confirmation page. Once per order in this
 * browser: the page can be reloaded, or opened again from the email.
 */
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

/**
 * Reports what goes into the cart: one AddToCart per change that adds, with
 * what it added. Not on load: the cart coming back out of localStorage is not
 * the visitor adding anything.
 */
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

/** The pixel's cookies, on this host and each domain above it, where Meta may have set them. */
function forgetCookies(): void {
  const parts = location.hostname.split(".")
  const domains = [""]
  for (let i = 0; i < parts.length - 1; i++) domains.push(`; domain=.${parts.slice(i).join(".")}`)
  for (const name of ["_fbp", "_fbc"]) {
    for (const domain of domains) document.cookie = `${name}=; Max-Age=0; path=/${domain}`
  }
}

/**
 * Meta holds back what it is asked while revoked and sends it all on the next
 * grant. Nothing of ours is asked then (install), so what it holds is its
 * own: the PageViews of route changes after Decline, which a later Accept
 * does not hand over. Before Meta's script has arrived the queue is still
 * the page's, and only what came after the revoke goes.
 */
function forgetHeldEvents(queue: ArrayLike<unknown>[]): void {
  let from = 0
  queue.forEach((call, i) => {
    if (call[0] === "consent" && call[1] === "revoke") from = i + 1
  })
  queue.splice(from)
}

/**
 * A change of mind on a page where the pixel is already running: taking
 * Accept back stops it and deletes its cookies; a new Accept after that
 * resumes it.
 */
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
