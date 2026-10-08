import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// The module remembers whether it loaded, so each test imports a fresh copy.

type Queue = unknown[][]
const g = globalThis as unknown as Record<string, unknown>

let appended: { src?: string }[]
let cookies: string[]
let store: Map<string, string>

beforeEach(() => {
  vi.resetModules()
  vi.stubEnv("NODE_ENV", "production")
  appended = []
  cookies = []
  store = new Map()
  g.window = globalThis
  g.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  }
  g.location = { hostname: "www.skelmet.in" }
  g.document = {
    createElement: () => ({}),
    head: { appendChild: (el: { src?: string }) => void appended.push(el) },
    set cookie(value: string) {
      cookies.push(value)
    },
  }
})

afterEach(() => {
  vi.unstubAllEnvs()
  for (const key of ["window", "localStorage", "location", "document", "fbq", "_fbq"]) delete g[key]
})

type Consent = { consent: "granted" | "denied" | null; revision: number | null }

async function choose(consent: Consent) {
  const { useConsent } = await import("@/features/visitors/hooks/use-consent")
  useConsent.setState(consent)
}

async function load(consent: Consent) {
  await choose(consent)
  return import("@/features/visitors/lib/meta-pixel")
}

const queue = () => ((g.fbq as { queue?: Queue } | undefined)?.queue ?? []) as Queue
const tracked = () => queue().filter((call) => call[0] === "track")

describe("contentsOf", () => {
  it("gives Meta the SKUs, quantities and value in rupees", async () => {
    const { contentsOf } = await load({ consent: null, revision: null })
    expect(
      contentsOf([
        { sku: "SKM-FLAME-ORANGE", qty: 2, unitPrice: "1499.50" },
        { sku: "SKM-FLAME-OLIVE", qty: 1, unitPrice: 1499 },
      ]),
    ).toEqual({
      content_ids: ["SKM-FLAME-ORANGE", "SKM-FLAME-OLIVE"],
      contents: [
        { id: "SKM-FLAME-ORANGE", quantity: 2 },
        { id: "SKM-FLAME-OLIVE", quantity: 1 },
      ],
      content_type: "product",
      num_items: 3,
      value: 4498,
      currency: "INR",
    })
  })
})

describe("the pixel", () => {
  it("loads Meta's script and sends data automatically even before the visitor answers", async () => {
    const pixel = await load({ consent: null, revision: null })
    pixel.pixelPageView()
    pixel.pixelViewContent({ sku: "SKM-FLAME-ORANGE", name: "Flame Skull Mount", price: "1499" })
    expect(g.fbq).toBeDefined()
    expect(appended).toEqual([
      expect.objectContaining({ src: "https://connect.facebook.net/en_US/fbevents.js" }),
    ])
  })

  it("loads nothing for a visitor who declined", async () => {
    const pixel = await load({ consent: "denied", revision: 2 })
    pixel.pixelPageView()
    expect(g.fbq).toBeUndefined()
    expect(appended).toEqual([])
  })

  it("loads nothing on an Accept given before it covered the pixel", async () => {
    const pixel = await load({ consent: "granted", revision: 1 })
    pixel.pixelPageView()
    const legacy = await load({ consent: "granted", revision: null })
    legacy.pixelPageView()
    expect(g.fbq).toBeUndefined()
    expect(appended).toEqual([])
  })

  it("loads nothing outside a production build", async () => {
    vi.stubEnv("NODE_ENV", "development")
    const pixel = await load({ consent: "granted", revision: 2 })
    pixel.pixelPageView()
    expect(g.fbq).toBeUndefined()
  })

  it("after Accept, loads Meta's script once and reports the page", async () => {
    const pixel = await load({ consent: "granted", revision: 2 })
    pixel.pixelPageView()
    pixel.pixelPageView()
    expect(appended).toEqual([
      expect.objectContaining({ src: "https://connect.facebook.net/en_US/fbevents.js" }),
    ])
    // autoConfig off, before init.
    expect(queue().slice(0, 2)).toEqual([
      ["set", "autoConfig", false, "1023005070753961"],
      ["init", "1023005070753961"],
    ])
    expect(tracked()).toEqual([
      ["track", "PageView"],
      ["track", "PageView"],
    ])
    // Left on: Meta reports route changes itself.
    expect(g.fbq).not.toHaveProperty("disablePushState")
  })

  it("reports a purchase once per order, with its value and an event id", async () => {
    const pixel = await load({ consent: "granted", revision: 2 })
    const order = {
      number: "SKM-2026-AAAA",
      total: "3097",
      items: [{ sku: "SKM-FLAME-ORANGE", qty: 2, unitPrice: "1499" }],
    }
    pixel.pixelPurchase(order)
    pixel.pixelPurchase(order)
    const purchases = tracked().filter((call) => call[1] === "Purchase")
    expect(purchases).toHaveLength(1)
    expect(purchases[0]![2]).toMatchObject({ value: 3097, currency: "INR", num_items: 2 })
    expect(purchases[0]![3]).toEqual({ eventID: "purchase-SKM-2026-AAAA" })
  })

  it("on a taken-back Accept, revokes and deletes its cookies on every domain", async () => {
    const pixel = await load({ consent: "granted", revision: 2 })
    pixel.pixelPageView()
    pixel.pixelConsent(false)
    expect(queue()).toContainEqual(["consent", "revoke"])
    expect(cookies).toContain("_fbp=; Max-Age=0; path=/; domain=.skelmet.in")
    expect(cookies).toContain("_fbp=; Max-Age=0; path=/; domain=.www.skelmet.in")
    expect(cookies).toContain("_fbc=; Max-Age=0; path=/")
  })

  it("keeps the first page view of a new Accept", async () => {
    // The order MetaPixel runs them in.
    const pixel = await load({ consent: "granted", revision: 2 })
    pixel.pixelConsent(true)
    pixel.pixelPageView()
    pixel.pixelConsent(true)
    expect(tracked()).toEqual([["track", "PageView"]])
  })

  it("sends nothing from a taken-back Accept, then or on a later Accept", async () => {
    const id = "1023005070753961"
    const pixel = await load({ consent: "granted", revision: 2 })
    pixel.pixelPageView()
    await choose({ consent: "denied", revision: 2 })
    pixel.pixelConsent(false)
    pixel.pixelLead("Next drop list")
    // Meta's route-change hook, while revoked.
    queue().push(["trackCustom", "PageView"])
    await choose({ consent: "granted", revision: 2 })
    pixel.pixelConsent(true)
    expect(queue()).toEqual([
      ["set", "autoConfig", false, id],
      ["init", id],
      ["track", "PageView"],
      ["consent", "revoke"],
      ["consent", "grant"],
    ])
  })
})
