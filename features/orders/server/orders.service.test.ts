import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * The dashboard's "today" is India's day, and counts orders that were paid -
 * not every order written, most of which are closed payment windows.
 */

const mocks = vi.hoisted(() => ({
  db: {
    order: { count: vi.fn(), aggregate: vi.fn(), findMany: vi.fn() },
    variant: { findMany: vi.fn() },
  },
}))

vi.mock("@/server/db", () => ({ db: mocks.db }))
vi.mock("@/lib/env", () => ({ hasDatabase: () => true }))
vi.mock("@/server/action-guard", () => ({ requirePermission: async () => ({ user: { id: "a" } }) }))
vi.mock("@/server/audit", () => ({ createAuditLog: vi.fn(), getAuditMeta: async () => ({}) }))
vi.mock("@/features/checkout/server/checkout.service", () => ({ releaseStaleOrders: vi.fn() }))
vi.mock("@/features/invoices/server/invoice.service", () => ({
  creditNoteOnRefund: vi.fn(),
  queueInvoiceEmail: vi.fn(),
}))
vi.mock("@/features/checkout/server/payment-gateway", () => ({
  modeOfPayment: vi.fn(),
  refundPayment: vi.fn(),
}))
vi.mock("@/features/settings/server/runtime-settings", () => ({ paymentConfig: vi.fn() }))
vi.mock("@/features/shipping/server/shiprocket", () => ({ isShiprocketConfigured: vi.fn() }))
vi.mock("@/features/shipping/server/shipping.service", () => ({
  cancelShiprocketOrder: vi.fn(),
  notifyShipped: vi.fn(),
}))

const { getDashboard, startOfIndianDay } = await import("@/features/orders/server/orders.service")

beforeEach(() => {
  vi.clearAllMocks()
  mocks.db.order.count.mockResolvedValue(0)
  mocks.db.order.aggregate.mockResolvedValue({ _sum: { total: null } })
  mocks.db.order.findMany.mockResolvedValue([])
  mocks.db.variant.findMany.mockResolvedValue([])
})

describe("startOfIndianDay", () => {
  it("is midnight in India, which is 18:30 UTC the evening before", () => {
    expect(startOfIndianDay(new Date("2026-09-28T10:00:00Z")).toISOString()).toBe(
      "2026-09-27T18:30:00.000Z",
    )
  })

  it("has already moved on at 00:30 in India, when UTC is still on yesterday", () => {
    expect(startOfIndianDay(new Date("2026-09-28T19:00:00Z")).toISOString()).toBe(
      "2026-09-28T18:30:00.000Z",
    )
  })
})

describe("getDashboard", () => {
  it("counts today's paid orders from India's midnight", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-09-28T19:00:00Z"))
    try {
      await getDashboard()
    } finally {
      vi.useRealTimers()
    }
    const [today] = mocks.db.order.count.mock.calls[0]!
    expect(today).toEqual({
      where: {
        placedAt: { gte: new Date("2026-09-28T18:30:00.000Z") },
        status: { in: ["PAID", "PACKED", "SHIPPED", "DELIVERED", "RETURNED", "REFUNDED"] },
      },
    })
  })
})
