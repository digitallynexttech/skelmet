import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * The cart's coupon check must not tell a guesser which codes exist, and an
 * edit must keep to the same 90% rule a new coupon does.
 */

const mocks = vi.hoisted(() => ({
  db: {
    coupon: { findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    auditLog: { findMany: vi.fn() },
    order: { findMany: vi.fn() },
  },
}))

vi.mock("@/server/db", () => ({ db: mocks.db }))
vi.mock("@/lib/env", () => ({ hasDatabase: () => true }))
const viewer = vi.hoisted(() => ({ permissions: ["coupon:read", "order:read"] }))
vi.mock("@/server/action-guard", () => ({
  requirePermission: async () => ({ user: { id: "a", permissions: viewer.permissions } }),
  can: (session: { user: { permissions: string[] } }, scope: string) =>
    session.user.permissions.includes(scope),
}))
vi.mock("@/server/audit", () => ({ createAuditLog: vi.fn(), getAuditMeta: async () => ({}) }))

const {
  createCoupon,
  getCouponHistory,
  listCartOffers,
  listCoupons,
  renewCoupon,
  updateCoupon,
  validateCoupon,
} = await import("@/features/coupons/server/coupons.service")
const { createCouponSchema, updateCouponSchema } =
  await import("@/features/coupons/schemas/coupon.schema")

const coupon = (over: Record<string, unknown> = {}) => ({
  code: "RIDE10",
  kind: "PERCENT",
  value: "10",
  minSubtotal: "0",
  maxUses: null,
  usedCount: 0,
  expiresAt: null,
  ...over,
})

beforeEach(() => vi.clearAllMocks())

describe("validateCoupon", () => {
  it("answers the same for a missing, an expired and a used-up code", async () => {
    const answers = []
    for (const found of [
      null,
      coupon({ archivedAt: new Date(Date.now() - 60_000) }),
      coupon({ expiresAt: new Date(Date.now() - 60_000) }),
      coupon({ maxUses: 3, usedCount: 3 }),
    ]) {
      mocks.db.coupon.findUnique.mockResolvedValueOnce(found)
      answers.push(await validateCoupon({ code: "RIDE10", subtotal: 3499 }))
    }
    for (const answer of answers) {
      expect(answer).toEqual({
        ok: false,
        error: "This code can't be used.",
        status: 422,
        details: undefined,
      })
    }
  })

  it("names the minimum spend, formatted the Indian way", async () => {
    mocks.db.coupon.findUnique.mockResolvedValue(coupon({ minSubtotal: "125000" }))
    expect(await validateCoupon({ code: "RIDE10", subtotal: 3499 })).toMatchObject({
      ok: false,
      error: "Spend at least ₹1,25,000 to use that code.",
    })
  })

  it("applies a live code", async () => {
    mocks.db.coupon.findUnique.mockResolvedValue(coupon())
    expect(await validateCoupon({ code: "ride10", subtotal: 3499 })).toEqual({
      ok: true,
      data: { code: "RIDE10", discount: 350, label: "10% off" },
    })
  })
})

describe("the 90% rule", () => {
  it("holds for a new coupon and for an edit sending both halves", () => {
    expect(createCouponSchema.safeParse({ code: "BIG", kind: "PERCENT", value: 95 }).success).toBe(
      false,
    )
    expect(updateCouponSchema.safeParse({ kind: "PERCENT", value: 95 }).success).toBe(false)
    expect(updateCouponSchema.safeParse({ kind: "FLAT", value: 950 }).success).toBe(true)
  })

  it("holds for an edit sending only the value, against the stored kind", async () => {
    mocks.db.coupon.findUnique.mockResolvedValue({ id: "c1", kind: "PERCENT", value: "10" })
    expect(await updateCoupon("c1", { value: 95 })).toMatchObject({ ok: false, status: 422 })
    expect(mocks.db.coupon.update).not.toHaveBeenCalled()
  })

  it("holds for an edit switching a large flat coupon to percent", async () => {
    mocks.db.coupon.findUnique.mockResolvedValue({ id: "c1", kind: "FLAT", value: "500" })
    expect(await updateCoupon("c1", { kind: "PERCENT" })).toMatchObject({ ok: false, status: 422 })
  })
})

const row = (code: string, over: Record<string, unknown> = {}) => ({
  id: code,
  code,
  kind: "FLAT",
  value: "250",
  minSubtotal: "0",
  maxUses: null,
  usedCount: 0,
  expiresAt: null,
  archivedAt: null,
  showInCart: false,
  createdAt: new Date("2026-09-01"),
  ...over,
})

describe("listCoupons", () => {
  it("puts live codes above used-up ones, and expired ones last", async () => {
    mocks.db.coupon.findMany.mockResolvedValue([
      row("OLD", { expiresAt: new Date(Date.now() - 60_000) }),
      row("GONE", { maxUses: 1, usedCount: 1 }),
      row("LIVE"),
    ])
    const result = await listCoupons({})
    expect(result.ok && result.data.data.map((c) => c.code)).toEqual(["LIVE", "GONE", "OLD"])
  })

  it("keeps archived codes out of the list and in the archive", async () => {
    mocks.db.coupon.findMany.mockResolvedValue([])
    await listCoupons({})
    expect(mocks.db.coupon.findMany.mock.calls[0]![0].where.archivedAt).toBeNull()
    await listCoupons({ view: "archived" })
    expect(mocks.db.coupon.findMany.mock.calls[1]![0].where.archivedAt).toEqual({ not: null })
  })
})

describe("listCartOffers", () => {
  it("offers only codes switched on, not archived and still usable", async () => {
    mocks.db.coupon.findMany.mockResolvedValue([
      coupon({ code: "LIVE", kind: "FLAT", value: "500", minSubtotal: "3000" }),
      coupon({ code: "OLD", expiresAt: new Date(Date.now() - 60_000) }),
      coupon({ code: "GONE", maxUses: 2, usedCount: 2 }),
    ])
    const result = await listCartOffers()
    expect(mocks.db.coupon.findMany.mock.calls[0]![0].where).toEqual({
      showInCart: true,
      archivedAt: null,
    })
    expect(result).toEqual({
      ok: true,
      data: [{ code: "LIVE", label: "₹500 off", minSubtotal: "3000", expiresAt: null }],
    })
  })
})

describe("an old code run again", () => {
  it("creating a code that is over points to renewing it", async () => {
    mocks.db.coupon.findUnique.mockResolvedValue(
      row("DIWALI200", { expiresAt: new Date(Date.now() - 86_400_000), usedCount: 40 }),
    )
    const result = await createCoupon({ code: "diwali200", kind: "FLAT", value: 200 })
    expect(result).toMatchObject({
      ok: false,
      status: 409,
      details: { existing: { id: "DIWALI200", code: "DIWALI200", renewable: true } },
    })
    expect(!result.ok && result.error).toMatch(/Renew it/)
  })

  it("a live code is not offered for renewing", async () => {
    mocks.db.coupon.findUnique.mockResolvedValue(row("RIDE350"))
    const result = await createCoupon({ code: "RIDE350", kind: "FLAT", value: 350 })
    expect(result).toMatchObject({ status: 409, details: { existing: { renewable: false } } })
  })

  it("renewing keeps the code, starts the uses again and unarchives it", async () => {
    mocks.db.coupon.findUnique.mockResolvedValue({
      id: "DIWALI200",
      usedCount: 40,
      expiresAt: new Date("2025-11-01"),
      archivedAt: new Date("2025-11-02"),
    })
    mocks.db.coupon.update.mockResolvedValue(row("DIWALI200", { value: "200" }))
    const expiresAt = new Date(Date.now() + 30 * 86_400_000).toISOString()
    const result = await renewCoupon("DIWALI200", {
      kind: "FLAT",
      value: 200,
      maxUses: 500,
      expiresAt,
    })
    expect(result.ok).toBe(true)
    expect(mocks.db.coupon.update.mock.calls[0]![0].data).toMatchObject({
      value: 200,
      maxUses: 500,
      usedCount: 0,
      archivedAt: null,
    })
  })

  it("will not renew to an expiry already past", async () => {
    mocks.db.coupon.findUnique.mockResolvedValue({
      id: "D",
      usedCount: 0,
      expiresAt: null,
      archivedAt: null,
    })
    const result = await renewCoupon("D", { kind: "FLAT", value: 200, expiresAt: "2020-01-01" })
    expect(result).toMatchObject({ ok: false, status: 422 })
    expect(mocks.db.coupon.update).not.toHaveBeenCalled()
  })
})

describe("getCouponHistory", () => {
  const setUp = () => {
    mocks.db.coupon.findUnique.mockResolvedValue(
      row("DIWALI200", { createdAt: new Date("2025-10-20"), value: "300" }),
    )
    mocks.db.auditLog.findMany.mockResolvedValue([
      {
        action: "coupon:create",
        meta: { kind: "FLAT", value: "200" },
        createdAt: new Date("2025-10-20"),
        actor: { name: "Diwakar", email: "d@x" },
      },
      {
        action: "coupon:renew",
        meta: { kind: "FLAT", value: "300", previousUses: 1 },
        createdAt: new Date("2026-10-15"),
        actor: null,
      },
    ])
    mocks.db.order.findMany.mockResolvedValue([
      {
        id: "o2",
        number: "SKM-2",
        status: "PAID",
        email: "b@x",
        shippingAddress: { firstName: "Bo" },
        subtotal: "3499",
        discount: "300",
        total: "3199",
        placedAt: new Date("2026-10-20"),
        createdAt: new Date("2026-10-20"),
      },
      {
        id: "o1",
        number: "SKM-1",
        status: "DELIVERED",
        email: "a@x",
        shippingAddress: {},
        subtotal: "3499",
        discount: "200",
        total: "3299",
        placedAt: new Date("2025-10-25"),
        createdAt: new Date("2025-10-25"),
      },
    ])
  }

  it("gives the runs newest first, and each order its run", async () => {
    setUp()
    const result = await getCouponHistory("DIWALI200")
    if (!result.ok) throw new Error(result.error)
    expect(result.data.runs.map((r) => [r.index, r.orders, r.discount])).toEqual([
      [2, 1, 300],
      [1, 1, 200],
    ])
    expect(result.data.orders.map((o) => [o.number, o.run, o.customer])).toEqual([
      ["SKM-2", 2, "Bo"],
      ["SKM-1", 1, "Guest"],
    ])
  })

  it("keeps the orders from staff who may not see orders, but not the totals", async () => {
    setUp()
    viewer.permissions = ["coupon:read"]
    const result = await getCouponHistory("DIWALI200")
    viewer.permissions = ["coupon:read", "order:read"]
    if (!result.ok) throw new Error(result.error)
    expect(result.data.orders).toEqual([])
    expect(result.data.canSeeOrders).toBe(false)
    expect(result.data.runs.reduce((n, r) => n + r.orders, 0)).toBe(2)
  })
})
