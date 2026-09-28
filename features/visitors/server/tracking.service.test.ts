import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * The tracker's promises to visitors, pinned down: a visit made without
 * consent keeps no IP address, sets no cookie and keeps nothing typed at
 * checkout; taking consent back forgets the device; bots and staff are never
 * counted. These are what the cookie bar and the privacy policy say, so a
 * change that breaks one should fail here, not in front of a customer.
 */

const mocks = vi.hoisted(() => ({
  headers: { current: new Headers() },
  cookies: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
  session: { current: null as null | { user: { kind: string } } },
  db: {
    visitor: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
    visitorSession: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
    visitorEvent: { create: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
    cart: {
      upsert: vi.fn(),
      updateMany: vi.fn(),
      findUnique: vi.fn(),
      deleteMany: vi.fn(),
      update: vi.fn(),
    },
    cartItem: { deleteMany: vi.fn(), createMany: vi.fn() },
    variant: { findMany: vi.fn() },
    order: { update: vi.fn(), updateMany: vi.fn() },
    user: { findFirst: vi.fn() },
    pincodePlace: { findUnique: vi.fn(), upsert: vi.fn() },
    $transaction: vi.fn(),
  },
}))

vi.mock("next/headers", () => ({
  headers: async () => mocks.headers.current,
  cookies: async () => mocks.cookies,
}))
vi.mock("@/server/action-guard", () => ({ optionalSession: async () => mocks.session.current }))
vi.mock("@/lib/env", () => ({ hasDatabase: () => true }))
vi.mock("@/server/db", () => ({ db: mocks.db }))

const { recordVisit } = await import("@/features/visitors/server/tracking.service")

const SID = "4f8b6c1e-2d3a-4b5c-9d7e-1a2b3c4d5e6f"
const PV = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d"
const KNOWN = "0b1c2d3e-4f50-4a61-8b72-9c8d7e6f5a4b"
const PHONE_UA =
  "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36"

const view = (consent: boolean) => ({
  t: "view",
  sid: SID,
  consent,
  pv: PV,
  path: "/product/flame-skull-mount?utm_source=ig",
  device: { screen: "412x915", model: "SM-S918B", platformVersion: "14.0.0" },
})

const nothingRecorded = { ok: true, data: { recorded: false } }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.headers.current = new Headers({
    "user-agent": PHONE_UA,
    "cf-connecting-ip": "203.0.113.9",
    "cf-ipcountry": "IN",
    "cf-ipcity": "Jaipur",
    "cf-region": "Rajasthan",
    "cf-postal-code": "302001",
    host: "skelmet.in",
  })
  mocks.session.current = null
  mocks.cookies.get.mockReturnValue(undefined)

  const db = mocks.db
  db.$transaction.mockImplementation(async (work: unknown) =>
    typeof work === "function" ? work(db) : Promise.all(work as Promise<unknown>[]),
  )
  db.visitor.findUnique.mockResolvedValue(null)
  db.visitor.findFirst.mockResolvedValue(null)
  db.visitor.create.mockImplementation(async ({ data }: { data: { anonymous: boolean } }) => ({
    id: "visitor-1",
    anonymous: data.anonymous,
  }))
  db.visitorSession.findUnique.mockResolvedValue(null)
  db.visitorSession.create.mockResolvedValue({ id: "session-1", pageviews: 0 })
  db.cart.upsert.mockResolvedValue({ id: "cart-1" })
  // 302001 has been looked up before.
  db.pincodePlace.findUnique.mockResolvedValue({ district: "Jaipur" })
})

describe("recordVisit without consent", () => {
  it("keeps no IP address, pincode area, phone model or user agent, and sets no cookie", async () => {
    expect(await recordVisit(view(false))).toEqual({ ok: true, data: { recorded: true } })

    const created = mocks.db.visitor.create.mock.calls[0]![0].data
    expect(created).toMatchObject({
      anonymous: true,
      anonKey: SID,
      city: "Jaipur",
      deviceType: "mobile",
      os: "Android 14",
      source: "ig",
    })
    for (const field of ["ip", "postalCode", "deviceModel", "userAgent", "consentAt"]) {
      expect(created, field).not.toHaveProperty(field)
    }
    expect(mocks.db.visitorSession.create.mock.calls[0]![0].data.ip).toBeNull()
    for (const [call] of mocks.db.visitor.update.mock.calls) {
      expect(call.data).not.toHaveProperty("ip")
    }
    expect(mocks.cookies.set).not.toHaveBeenCalled()
  })

  it("keeps the city, district and state, but not the pincode that found the district", async () => {
    await recordVisit(view(false))

    const created = mocks.db.visitor.create.mock.calls[0]![0].data
    expect(created).toMatchObject({ city: "Jaipur", district: "Jaipur", region: "Rajasthan" })
    expect(created).not.toHaveProperty("postalCode")
    expect(mocks.db.visitorSession.create.mock.calls[0]![0].data).toMatchObject({
      city: "Jaipur",
      district: "Jaipur",
      region: "Rajasthan",
      ip: null,
    })
  })

  it("looks up a pincode seen for the first time, after the response", async () => {
    mocks.db.pincodePlace.findUnique.mockResolvedValue(null)
    const fetch = vi.fn(async (_url: string) =>
      Response.json([
        {
          Status: "Success",
          PostOffice: [{ District: "Jaipur", State: "Rajasthan", DeliveryStatus: "Delivery" }],
        },
      ]),
    )
    vi.stubGlobal("fetch", fetch)
    try {
      await recordVisit(view(false))

      // Not known yet: written in once the lookup answers.
      expect(mocks.db.visitor.create.mock.calls[0]![0].data.district).toBeUndefined()
      await vi.waitFor(() =>
        expect(mocks.db.visitorSession.updateMany).toHaveBeenCalledWith({
          where: { id: "session-1" },
          data: { district: "Jaipur" },
        }),
      )
      expect(String(fetch.mock.calls[0]![0])).toMatch(/\/302001$/)
      expect(mocks.db.pincodePlace.upsert.mock.calls[0]![0].create).toEqual({
        pincode: "302001",
        district: "Jaipur",
        state: "Rajasthan",
      })
      expect(mocks.db.visitor.updateMany).toHaveBeenCalledWith({
        where: { id: "visitor-1" },
        data: { district: "Jaipur" },
      })
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it("does not keep details typed at checkout", async () => {
    mocks.db.visitor.findUnique.mockResolvedValue({ id: "visitor-1", anonymous: true })
    mocks.db.visitorSession.findUnique.mockResolvedValue({ id: "session-1", pageviews: 3 })

    const result = await recordVisit({
      t: "contact",
      sid: SID,
      consent: false,
      email: "rider@example.in",
      phone: "9876543210",
    })

    expect(result).toEqual(nothingRecorded)
    for (const [call] of mocks.db.visitor.update.mock.calls) {
      expect(call.data).not.toHaveProperty("email")
      expect(call.data).not.toHaveProperty("phone")
    }
  })

  it("will not keep them even from a visitor the cookie says accepted", async () => {
    // The message's own flag wins: the browser is the record of the choice.
    mocks.cookies.get.mockReturnValue({ value: KNOWN })
    mocks.db.visitor.findUnique.mockResolvedValue({ id: "visitor-1", anonymous: true })
    mocks.db.visitorSession.findUnique.mockResolvedValue({ id: "session-1", pageviews: 3 })

    await recordVisit({ t: "contact", sid: SID, consent: false, email: "rider@example.in" })

    expect(mocks.db.visitor.findFirst).not.toHaveBeenCalled()
    expect(mocks.db.visitor.update).not.toHaveBeenCalled()
  })
})

describe("recordVisit with consent", () => {
  it("keeps the IP address and device, and sets the cookie", async () => {
    await recordVisit(view(true))

    const created = mocks.db.visitor.create.mock.calls[0]![0].data
    expect(created).toMatchObject({
      anonymous: false,
      ip: "203.0.113.9",
      postalCode: "302001",
      deviceModel: "SM-S918B",
      userAgent: PHONE_UA,
    })
    expect(created.consentAt).toBeInstanceOf(Date)
    expect(mocks.cookies.set).toHaveBeenCalledWith(
      "skm.vid",
      "visitor-1",
      expect.objectContaining({ httpOnly: true, sameSite: "lax" }),
    )
  })

  it("keeps details typed at checkout, the email lower-cased", async () => {
    mocks.cookies.get.mockReturnValue({ value: KNOWN })
    mocks.db.visitor.findFirst.mockResolvedValue({ id: KNOWN, anonymous: false })
    mocks.db.visitorSession.findUnique.mockResolvedValue({ id: "session-1", pageviews: 3 })

    await recordVisit({
      t: "contact",
      sid: SID,
      consent: true,
      email: "Rider@Example.in",
      phone: "9876543210",
    })

    expect(mocks.db.visitor.update).toHaveBeenCalledWith({
      where: { id: KNOWN },
      data: expect.objectContaining({ email: "rider@example.in", phone: "9876543210" }),
    })
  })

  it("forgets the device when consent is taken back", async () => {
    mocks.cookies.get.mockReturnValue({ value: KNOWN })

    await recordVisit({ t: "consent", sid: SID, consent: false })

    expect(mocks.cookies.delete).toHaveBeenCalledWith("skm.vid")
    expect(mocks.db.visitor.updateMany).toHaveBeenCalledWith({
      where: { id: KNOWN, anonymous: false },
      data: expect.objectContaining({
        anonymous: true,
        ip: null,
        email: null,
        phone: null,
        name: null,
        userId: null,
      }),
    })
    expect(mocks.db.visitorSession.updateMany).toHaveBeenCalledWith({
      where: { visitorId: KNOWN },
      data: { ip: null },
    })
    expect(mocks.db.order.updateMany).toHaveBeenCalledWith({
      where: { visitorId: KNOWN },
      data: { visitorId: null },
    })
    // The order number on a "placed" event would lead back to the person.
    expect(mocks.db.visitorEvent.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { visitorId: KNOWN, type: "placed" } }),
    )
  })

  it("keeps the pages seen before Accept, and gives that visit its IP address", async () => {
    mocks.db.visitor.findUnique.mockResolvedValue({ id: "visitor-1", anonymous: true })
    mocks.db.visitor.update.mockResolvedValue({ id: "visitor-1", anonymous: false })
    mocks.db.visitorSession.findUnique.mockResolvedValue({ id: "session-1", pageviews: 1 })

    await recordVisit({ t: "consent", sid: SID, consent: true })

    expect(mocks.db.visitor.create).not.toHaveBeenCalled()
    expect(mocks.db.visitor.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "visitor-1" },
        data: expect.objectContaining({ anonymous: false, anonKey: null, ip: "203.0.113.9" }),
      }),
    )
    expect(mocks.db.visitorSession.updateMany).toHaveBeenCalledWith({
      where: { visitorId: "visitor-1", key: SID },
      data: { ip: "203.0.113.9" },
    })
    expect(mocks.cookies.set).toHaveBeenCalledWith("skm.vid", "visitor-1", expect.anything())
  })

  it("folds an anonymous stretch into the visit the device already has, not beside it", async () => {
    // Known device, whose choice was cleared mid-visit and then given again.
    mocks.cookies.get.mockReturnValue({ value: KNOWN })
    mocks.db.visitor.findFirst.mockResolvedValue({ id: KNOWN, anonymous: false })
    mocks.db.visitor.findUnique.mockResolvedValue({ id: "anon-1", anonymous: true })
    mocks.db.visitorSession.findUnique
      .mockResolvedValueOnce({ id: "known-session" })
      .mockResolvedValueOnce({ id: "anon-session", pageviews: 2, engagedSeconds: 30 })
      .mockResolvedValue({ id: "known-session", pageviews: 7 })
    mocks.db.cart.findUnique.mockResolvedValue(null)
    mocks.db.visitor.delete.mockResolvedValue({ visitCount: 1, pageviews: 2, engagedSeconds: 30 })

    await recordVisit({ t: "consent", sid: SID, consent: true })

    expect(mocks.db.visitorEvent.updateMany).toHaveBeenCalledWith({
      where: { sessionId: "anon-session" },
      data: { visitorId: KNOWN, sessionId: "known-session" },
    })
    expect(mocks.db.visitorSession.delete).toHaveBeenCalledWith({ where: { id: "anon-session" } })
    expect(mocks.db.visitor.update).toHaveBeenCalledWith({
      where: { id: KNOWN },
      data: {
        visitCount: { increment: 0 },
        pageviews: { increment: 2 },
        engagedSeconds: { increment: 30 },
      },
    })
  })
})

describe("recordVisit", () => {
  it("does not count bots", async () => {
    mocks.headers.current = new Headers({
      "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    })
    expect(await recordVisit(view(true))).toEqual(nothingRecorded)
    expect(mocks.db.visitor.create).not.toHaveBeenCalled()
  })

  it("does not count staff looking at their own shop", async () => {
    mocks.session.current = { user: { kind: "STAFF" } }
    expect(await recordVisit(view(true))).toEqual(nothingRecorded)
    expect(mocks.db.visitor.create).not.toHaveBeenCalled()
  })

  it("adds time only to a page seen on the same visit", async () => {
    mocks.db.visitorEvent.findFirst.mockResolvedValue(null)

    expect(await recordVisit({ t: "time", sid: SID, consent: true, pv: PV, s: 30 })).toEqual(
      nothingRecorded,
    )
    expect(mocks.db.visitorEvent.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: PV, type: "view", session: { key: SID } } }),
    )
    expect(mocks.db.visitorEvent.updateMany).not.toHaveBeenCalled()
  })

  it("prices a cart from the database and merges repeated lines", async () => {
    mocks.db.visitor.findUnique.mockResolvedValue({ id: "visitor-1", anonymous: true })
    mocks.db.visitorSession.findUnique.mockResolvedValue({ id: "session-1", pageviews: 2 })
    mocks.db.variant.findMany.mockResolvedValue([{ id: "variant-1", sku: "SKM-BLZ", price: 2499 }])

    await recordVisit({
      t: "cart",
      sid: SID,
      consent: false,
      items: [
        { sku: "SKM-BLZ", qty: 2 },
        { sku: "SKM-BLZ", qty: 1 },
        { sku: "NOT-A-SKU", qty: 1 },
      ],
    })

    expect(mocks.db.cartItem.createMany).toHaveBeenCalledWith({
      data: [{ variantId: "variant-1", qty: 3, unitPrice: 2499, cartId: "cart-1" }],
    })
    expect(mocks.db.visitorEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "cart",
        data: expect.objectContaining({ value: "7497.00" }),
      }),
    })
  })
})
