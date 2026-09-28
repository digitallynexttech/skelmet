import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * The storefront's pincode check: a slow Shiprocket must not hold a buyer at
 * checkout, and the answers it keeps must not grow without bound.
 */

const mocks = vi.hoisted(() => ({
  serviceability: vi.fn(),
  postcodeDetails: vi.fn(),
  pickupAddress: vi.fn(),
}))

vi.mock("@/features/shipping/server/shiprocket", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/shipping/server/shiprocket")>()
  return {
    ...actual,
    serviceability: mocks.serviceability,
    postcodeDetails: mocks.postcodeDetails,
    pickupAddress: mocks.pickupAddress,
  }
})
vi.mock("@/features/settings/server/runtime-settings", () => ({
  shiprocketConfig: async () => ({
    apiUrl: "https://apiv2.shiprocket.in",
    email: "api@skelmet.in",
    password: "secret",
    pickupLocation: "Noida",
    webhookToken: null,
  }),
  shippingCharge: async () => ({ aboveRupees: 0, sharePercent: 0, basis: "cheapest" }),
}))
vi.mock("@/features/invoices/server/invoice.service", () => ({ queueInvoiceEmail: vi.fn() }))
vi.mock("@/server/db", () => ({ db: {} }))
vi.mock("@/server/audit", () => ({ createAuditLog: vi.fn(), getAuditMeta: async () => ({}) }))
vi.mock("@/server/action-guard", () => ({ requirePermission: vi.fn() }))

const service = await import("@/features/shipping/server/shipping.service")

const OFFLINE = {
  live: false,
  serviceable: true,
  days: null,
  found: true,
  city: null,
  state: null,
  shippingFee: 0,
}

beforeEach(() => {
  vi.clearAllMocks()
  service.forgetPincodeChecks()
  mocks.pickupAddress.mockResolvedValue({ name: "Noida", pincode: "201301" })
  mocks.postcodeDetails.mockResolvedValue({ city: "Jaipur", state: "Rajasthan" })
  mocks.serviceability.mockResolvedValue({ data: { available_courier_companies: [] } })
})

afterEach(() => {
  vi.useRealTimers()
})

describe("checkPincode", () => {
  it("answers as if Shiprocket were unavailable once the budget runs out", async () => {
    vi.useFakeTimers()
    mocks.serviceability.mockReturnValue(new Promise(() => {}))
    mocks.postcodeDetails.mockReturnValue(new Promise(() => {}))

    const pending = service.checkPincode({ pincode: "302001", units: 1 })
    await vi.advanceTimersByTimeAsync(service.PINCODE_BUDGET_MS + 10)

    expect(await pending).toEqual({ ok: true, data: OFFLINE })
  })

  it("keeps a fast answer, and serves the next check from the cache", async () => {
    const first = await service.checkPincode({ pincode: "302001", units: 1 })
    expect(first).toMatchObject({ ok: true, data: { live: true, city: "Jaipur" } })

    await service.checkPincode({ pincode: "302001", units: 1 })
    expect(mocks.serviceability).toHaveBeenCalledTimes(1)
  })

  it("holds at most PINCODE_CACHE_MAX answers, dropping the oldest", async () => {
    for (let i = 0; i < service.PINCODE_CACHE_MAX + 5; i++) {
      await service.checkPincode({ pincode: String(100000 + i), units: 1 })
    }
    const calls = mocks.serviceability.mock.calls.length

    // The newest is still cached; the first one was evicted and is asked again.
    await service.checkPincode({
      pincode: String(100000 + service.PINCODE_CACHE_MAX + 4),
      units: 1,
    })
    expect(mocks.serviceability.mock.calls.length).toBe(calls)
    await service.checkPincode({ pincode: "100000", units: 1 })
    expect(mocks.serviceability.mock.calls.length).toBe(calls + 1)
  })
})
