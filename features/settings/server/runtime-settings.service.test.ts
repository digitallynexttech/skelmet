import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  setting: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
  },
  refreshPaymentTerms: vi.fn(),
}))

vi.mock("@/server/db", () => ({ db: { setting: mocks.setting } }))
vi.mock("@/server/action-guard", () => ({
  requirePermission: async () => ({ user: { id: "admin-1", permissions: ["setting:write"] } }),
  can: () => true,
}))
vi.mock("@/server/audit", () => ({ createAuditLog: vi.fn(), getAuditMeta: async () => ({}) }))
vi.mock("@/features/catalog/server/refresh-storefront", () => ({
  refreshShippingTerms: vi.fn(),
  refreshPaymentTerms: mocks.refreshPaymentTerms,
}))
vi.mock("@/features/shipping/server/shiprocket", () => ({
  checkLogin: vi.fn(),
  pickupAddress: vi.fn(),
  resetShiprocketSession: vi.fn(),
}))
vi.mock("@/features/shipping/server/shipping.service", () => ({ forgetPincodeChecks: vi.fn() }))

const original = { ...process.env }
const SAVED_AT = new Date("2026-09-28T10:00:00.000Z")

async function load() {
  vi.resetModules()
  ;(globalThis as { skelmetSettingsRead?: unknown }).skelmetSettingsRead = undefined
  return import("@/features/settings/server/runtime-settings.service")
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.DATABASE_URL = "postgresql://x@localhost/db"
  process.env.AUTH_SECRET = "an-auth-secret-long-enough-for-the-test"
  mocks.setting.findUnique.mockResolvedValue({ value: {}, updatedAt: SAVED_AT })
  mocks.setting.findMany.mockResolvedValue([])
  mocks.setting.updateMany.mockResolvedValue({ count: 1 })
})

afterEach(() => {
  process.env = { ...original }
})

describe("saving a section", () => {
  const charge = { aboveRupees: 150, sharePercent: 50, basis: "cheapest" }

  it("writes only if the section is still the version it was read at", async () => {
    const service = await load()
    const result = await service.saveShippingCharge({ ...charge, version: SAVED_AT.toISOString() })
    expect(result.ok).toBe(true)
    expect(mocks.setting.updateMany).toHaveBeenCalledWith({
      where: { key: "shipping", updatedAt: SAVED_AT },
      data: { value: charge, updatedBy: "admin-1" },
    })
  })

  it("refuses when someone else saved since the form was opened", async () => {
    const service = await load()
    const result = await service.saveShippingCharge({
      ...charge,
      version: "2026-09-28T09:59:00.000Z",
    })
    expect(result).toMatchObject({ ok: false, status: 409, error: service.STALE_SETTINGS })
    expect(mocks.setting.updateMany).not.toHaveBeenCalled()
  })

  it("refuses when someone else saves between the read and the write", async () => {
    mocks.setting.updateMany.mockResolvedValue({ count: 0 })
    const service = await load()
    expect(await service.saveShippingCharge(charge)).toMatchObject({ ok: false, status: 409 })
  })

  it("creates a section never saved before, and loses cleanly to a simultaneous first save", async () => {
    mocks.setting.findUnique.mockResolvedValue(null)
    const service = await load()
    expect(await service.saveShippingCharge({ ...charge, version: null })).toMatchObject({
      ok: true,
    })
    expect(mocks.setting.create).toHaveBeenCalled()

    mocks.setting.create.mockRejectedValue(Object.assign(new Error("dup"), { code: "P2002" }))
    expect(await service.saveShippingCharge(charge)).toMatchObject({ ok: false, status: 409 })
  })
})

describe("the Pay on delivery section", () => {
  const options = {
    cod: { offer: "everyone", feeRupees: 100 },
    partial: { offer: "staff", feeRupees: 0, advanceKind: "PERCENT", advanceValue: 20 },
  }

  it("shows paying online only until something is saved", async () => {
    const service = await load()
    const result = await service.getRuntimeSettings()
    expect(result.ok && result.data.checkout).toEqual({
      cod: { offer: "off", feeRupees: 0 },
      partial: { offer: "off", feeRupees: 0, advanceKind: "PERCENT", advanceValue: 20 },
      source: "default",
    })
  })

  it("saves the ways to pay and refreshes the pages that state them", async () => {
    const service = await load()
    const result = await service.savePaymentOptions({ ...options, version: SAVED_AT.toISOString() })
    expect(result.ok).toBe(true)
    expect(mocks.setting.updateMany).toHaveBeenCalledWith({
      where: { key: "checkout", updatedAt: SAVED_AT },
      data: { value: options, updatedBy: "admin-1" },
    })
    expect(mocks.refreshPaymentTerms).toHaveBeenCalledTimes(1)
  })

  it("refuses a charge or an advance that is not a whole, sensible number", async () => {
    const service = await load()
    for (const bad of [
      { ...options, cod: { offer: "everyone", feeRupees: -5 } },
      { ...options, cod: { offer: "sometimes", feeRupees: 0 } },
      { ...options, partial: { ...options.partial, advanceValue: 100 } },
      { ...options, partial: { ...options.partial, advanceValue: 0 } },
    ]) {
      expect(await service.savePaymentOptions(bad)).toMatchObject({ ok: false, status: 422 })
    }
    expect(mocks.setting.updateMany).not.toHaveBeenCalled()
    expect(mocks.refreshPaymentTerms).not.toHaveBeenCalled()
  })
})

describe("the Shiprocket section", () => {
  it("shows whether the password is set, and nothing of it", async () => {
    const { seal } = await import("@/features/settings/server/secret-box")
    mocks.setting.findMany.mockImplementation(async (args: { select: { value?: boolean } }) =>
      args.select.value
        ? [
            {
              key: "shiprocket",
              value: { email: "api@skelmet.in", password: seal("a-long-shiprocket-password") },
            },
          ]
        : [{ key: "shiprocket", updatedAt: SAVED_AT }],
    )
    const service = await load()
    const view = await service.getRuntimeSettings()
    expect(view.ok && view.data.shiprocket.password).toMatchObject({ set: true, hint: null })
    expect(view.ok && view.data.versions.shiprocket).toBe(SAVED_AT.toISOString())
  })

  it("refuses a webhook token short enough to guess", async () => {
    const service = await load()
    expect(await service.saveShiprocketSettings({ webhookToken: "short-token" })).toMatchObject({
      ok: false,
      status: 422,
    })
    expect(await service.saveShiprocketSettings({ webhookToken: "x".repeat(32) })).toMatchObject({
      ok: true,
    })
  })
})
