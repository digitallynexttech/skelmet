import { afterEach, describe, expect, it, vi } from "vitest"

/**
 * When the saved settings cannot be read, payments stop rather than guess:
 * .env's keys may be a different Razorpay account from the one switched on.
 */

const original = { ...process.env }
const findMany = vi.fn()

vi.mock("@/server/db", () => ({ db: { setting: { findMany } } }))

async function load() {
  vi.resetModules()
  ;(globalThis as { skelmetSettingsRead?: unknown }).skelmetSettingsRead = undefined
  process.env.DATABASE_URL = "postgresql://x@localhost/db"
  process.env.AUTH_SECRET = "an-auth-secret-long-enough-for-the-test"
  process.env.PAYMENT_KEY_ID = "rzp_test_env"
  process.env.PAYMENT_KEY_SECRET = "env-secret"
  return import("@/features/settings/server/runtime-settings")
}

afterEach(() => {
  process.env = { ...original }
  findMany.mockReset()
  vi.restoreAllMocks()
})

describe("paymentConfig", () => {
  it("refuses with a 503 when the first read of the settings fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    findMany.mockRejectedValue(new Error("connection refused"))
    const settings = await load()

    await expect(settings.paymentConfig()).rejects.toMatchObject({
      status: 503,
      message: settings.PAYMENTS_UNAVAILABLE,
    })
    // Shipping keeps going on its defaults: only payments fail closed.
    await expect(settings.shippingCharge()).resolves.toBeTruthy()
  })

  it("keeps using what it read before when a later read fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    const start = Date.now()
    const now = vi.spyOn(Date, "now").mockReturnValue(start)
    findMany.mockResolvedValueOnce([])
    const settings = await load()
    expect((await settings.paymentConfig()).test.keyId).toBe("rzp_test_env")

    // Past the cache's life, and the database is gone: last known good.
    now.mockReturnValue(start + 60_000)
    findMany.mockRejectedValue(new Error("connection refused"))
    expect((await settings.paymentConfig()).test.keyId).toBe("rzp_test_env")

    // Forgotten by a save, so nothing known: fails closed rather than guessing.
    settings.forgetSettings()
    await expect(settings.paymentConfig()).rejects.toMatchObject({ status: 503 })
  })
})
