import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * The cart's coupon check must not tell a guesser which codes exist, and an
 * edit must keep to the same 90% rule a new coupon does.
 */

const mocks = vi.hoisted(() => ({
  db: {
    coupon: { findUnique: vi.fn(), update: vi.fn() },
  },
}))

vi.mock("@/server/db", () => ({ db: mocks.db }))
vi.mock("@/lib/env", () => ({ hasDatabase: () => true }))
vi.mock("@/server/action-guard", () => ({ requirePermission: async () => ({ user: { id: "a" } }) }))
vi.mock("@/server/audit", () => ({ createAuditLog: vi.fn(), getAuditMeta: async () => ({}) }))

const { updateCoupon, validateCoupon } = await import("@/features/coupons/server/coupons.service")
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
