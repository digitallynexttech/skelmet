import { beforeEach, describe, expect, it, vi } from "vitest"

import { DEFAULT_PAYMENT_OPTIONS } from "@/features/checkout/payment-options"
import type { PaymentOptions } from "@/features/settings/schemas/runtime-settings.schema"

/**
 * Who is offered which way of paying. The point of "staff only" is that the
 * owner can try cash on delivery on the live site before any customer sees
 * it, so what a signed-out visitor is shown is pinned down here.
 */

const mocks = vi.hoisted(() => ({
  paymentOptions: vi.fn(),
  collectsOnDelivery: vi.fn(),
  staffSession: vi.fn(),
}))

vi.mock("@/features/settings/server/runtime-settings", () => ({
  paymentOptions: mocks.paymentOptions,
}))
vi.mock("@/features/shipping/server/shipping.service", () => ({
  collectsOnDelivery: mocks.collectsOnDelivery,
}))
vi.mock("@/server/action-guard", () => ({ staffSession: mocks.staffSession }))

const { getCheckoutOptions, offeredMethods } =
  await import("@/features/checkout/server/payment-options.service")

const saved = (over: Partial<PaymentOptions>) =>
  mocks.paymentOptions.mockResolvedValue({ ...structuredClone(DEFAULT_PAYMENT_OPTIONS), ...over })

const ids = async () => (await offeredMethods()).methods.map((m) => m.id)

beforeEach(() => {
  vi.clearAllMocks()
  saved({})
  mocks.staffSession.mockResolvedValue(null)
  mocks.collectsOnDelivery.mockResolvedValue(true)
})

describe("offeredMethods", () => {
  it("is paying online alone until the console switches more on, and asks nobody who they are", async () => {
    expect(await ids()).toEqual(["ONLINE"])
    expect(mocks.staffSession).not.toHaveBeenCalled()
  })

  it("offers everyone what is switched on for everyone, with its charge and advance", async () => {
    saved({
      cod: { offer: "everyone", feeRupees: 100 },
      partial: { offer: "everyone", feeRupees: 0, advanceKind: "PERCENT", advanceValue: 20 },
    })
    expect((await offeredMethods()).methods).toEqual([
      { id: "ONLINE", fee: 0, advance: null, staffOnly: false },
      { id: "PARTIAL", fee: 0, advance: { kind: "PERCENT", value: 20 }, staffOnly: false },
      { id: "COD", fee: 100, advance: null, staffOnly: false },
    ])
  })

  it("keeps an option on test from everyone but signed-in staff", async () => {
    saved({ cod: { offer: "staff", feeRupees: 100 } })

    expect(await ids()).toEqual(["ONLINE"])

    mocks.staffSession.mockResolvedValue({ user: { kind: "CUSTOMER" } })
    expect(await ids()).toEqual(["ONLINE"])

    mocks.staffSession.mockResolvedValue({ user: { kind: "STAFF" } })
    expect((await offeredMethods()).methods.at(-1)).toEqual({
      id: "COD",
      fee: 100,
      advance: null,
      staffOnly: true,
    })
  })

  it("treats a session that cannot be read as nobody", async () => {
    saved({ cod: { offer: "staff", feeRupees: 0 } })
    mocks.staffSession.mockRejectedValue(new Error("session store down"))
    expect(await ids()).toEqual(["ONLINE"])
  })
})

describe("getCheckoutOptions", () => {
  it("does not ask Shiprocket while only paying online is offered", async () => {
    const result = await getCheckoutOptions({ pincode: "302001", units: "1" })
    expect(result).toMatchObject({
      ok: true,
      data: { methods: [{ id: "ONLINE", available: true }] },
    })
    expect(mocks.collectsOnDelivery).not.toHaveBeenCalled()
  })

  it("marks paying on delivery unavailable only where no courier collects", async () => {
    saved({ cod: { offer: "everyone", feeRupees: 100 } })
    const available = async () => {
      const result = await getCheckoutOptions({ pincode: "302001", units: "2" })
      return result.ok ? result.data.methods.map((m) => [m.id, m.available]) : null
    }

    expect(await available()).toEqual([
      ["ONLINE", true],
      ["COD", true],
    ])
    expect(mocks.collectsOnDelivery).toHaveBeenCalledWith("302001", 2)

    mocks.collectsOnDelivery.mockResolvedValue(false)
    expect(await available()).toEqual([
      ["ONLINE", true],
      ["COD", false],
    ])

    // Not knowing offers it: an outage refuses nobody.
    mocks.collectsOnDelivery.mockResolvedValue(null)
    expect(await available()).toEqual([
      ["ONLINE", true],
      ["COD", true],
    ])
  })

  it("rules nothing out before a pincode is typed, or on one that is not a pincode", async () => {
    saved({ cod: { offer: "everyone", feeRupees: 0 } })
    for (const pincode of [undefined, "", "30200", "abcdef"]) {
      const result = await getCheckoutOptions({ pincode })
      expect(result.ok && result.data.methods.every((m) => m.available)).toBe(true)
    }
    expect(mocks.collectsOnDelivery).not.toHaveBeenCalled()
  })
})
