import { describe, expect, it } from "vitest"

import { runOf, splitRuns } from "@/features/coupons/coupon-history"

const current = {
  kind: "FLAT" as const,
  value: "300",
  minSubtotal: "0",
  maxUses: 500,
  expiresAt: "2026-11-05T18:29:59.000Z",
}
const order = (at: string, status = "PAID", discount = "200", total = "3299") => ({
  at,
  status,
  discount,
  total,
})

describe("splitRuns", () => {
  const events = [
    {
      action: "coupon:create",
      at: "2025-10-20T00:00:00.000Z",
      by: "Diwakar",
      meta: { code: "DIWALI200", kind: "FLAT", value: "200" },
    },
    {
      action: "coupon:update",
      at: "2025-10-22T00:00:00.000Z",
      by: "Diwakar",
      meta: { showInCart: true },
    },
    {
      action: "coupon:renew",
      at: "2026-10-15T00:00:00.000Z",
      by: "Diwakar",
      meta: {
        previousUses: 3,
        previousExpiry: "2025-11-10T18:29:59.000Z",
        kind: "FLAT",
        value: 300,
        maxUses: 500,
      },
    },
  ]
  const runs = splitRuns({
    createdAt: "2025-10-20T00:00:00.000Z",
    current,
    events,
    orders: [
      order("2025-10-25T10:00:00.000Z"),
      order("2025-10-26T10:00:00.000Z"),
      order("2025-10-27T10:00:00.000Z", "CANCELLED"),
      order("2025-10-28T10:00:00.000Z", "REFUNDED"),
      order("2026-10-20T10:00:00.000Z", "DELIVERED", "300", "3199"),
    ],
  })

  it("cuts a run at each renewal", () => {
    expect(runs.map((r) => [r.index, r.startedBy, r.start, r.end])).toEqual([
      [1, "created", "2025-10-20T00:00:00.000Z", "2026-10-15T00:00:00.000Z"],
      [2, "renewed", "2026-10-15T00:00:00.000Z", null],
    ])
  })

  it("gives each run its own terms and expiry", () => {
    expect(runs[0]).toMatchObject({
      terms: { kind: "FLAT", value: "200" },
      expiresAt: "2025-11-10T18:29:59.000Z",
    })
    expect(runs[1]).toMatchObject({
      terms: { value: "300", maxUses: 500 },
      expiresAt: current.expiresAt,
    })
  })

  it("counts placed orders only, and refunds apart", () => {
    expect(runs[0]).toMatchObject({ orders: 2, discount: 400, sales: 6598, refunded: 1 })
    expect(runs[1]).toMatchObject({ orders: 1, discount: 300, sales: 3199, refunded: 0 })
    expect(runOf(runs, "2026-10-20T10:00:00.000Z")).toBe(2)
    expect(runOf(runs, "2025-10-25T10:00:00.000Z")).toBe(1)
  })

  it("is one run, on the code's own terms, for a code never renewed", () => {
    const one = splitRuns({
      createdAt: "2026-01-01T00:00:00.000Z",
      current,
      events: [],
      orders: [],
    })
    expect(one).toHaveLength(1)
    expect(one[0]).toMatchObject({ startedBy: "created", end: null, terms: { value: "300" } })
  })
})
