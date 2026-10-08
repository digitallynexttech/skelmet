import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  db: {
    order: {
      count: vi.fn(),
      aggregate: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    variant: { findMany: vi.fn(), update: vi.fn() },
    coupon: { updateMany: vi.fn() },
    payment: { updateMany: vi.fn() },
    $transaction: vi.fn(),
  },
  refundPayment: vi.fn(),
  cancelShiprocketOrder: vi.fn(),
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
  modeOfPayment: () => "live",
  refundPayment: mocks.refundPayment,
}))
vi.mock("@/features/settings/server/runtime-settings", () => ({ paymentConfig: vi.fn() }))
vi.mock("@/features/shipping/server/shiprocket", () => ({ isShiprocketConfigured: vi.fn() }))
vi.mock("@/features/shipping/server/shipping.service", () => ({
  cancelShiprocketOrder: mocks.cancelShiprocketOrder,
  notifyShipped: vi.fn(),
}))

const { cancelOrder, getDashboard, markPacked, refundOrder, startOfIndianDay } =
  await import("@/features/orders/server/orders.service")

beforeEach(() => {
  vi.clearAllMocks()
  mocks.db.order.updateMany.mockResolvedValue({ count: 1 })
  mocks.db.$transaction.mockResolvedValue([])
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
  it("counts today's paid and cash-on-delivery orders from India's midnight", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-09-28T19:00:00Z"))
    try {
      await getDashboard()
    } finally {
      vi.useRealTimers()
    }
    const [today] = mocks.db.order.count.mock.calls[0]!
    const midnight = new Date("2026-09-28T18:30:00.000Z")
    expect(today).toEqual({
      where: {
        OR: [
          {
            paymentMethod: { not: "COD" },
            placedAt: { gte: midnight },
            status: {
              in: ["CONFIRMED", "PAID", "PACKED", "SHIPPED", "DELIVERED", "RETURNED", "REFUNDED"],
            },
          },
          {
            paymentMethod: "COD",
            createdAt: { gte: midnight },
            status: { notIn: ["PENDING", "CANCELLED"] },
          },
        ],
      },
    })
  })
})

describe("an order paid for on delivery", () => {
  it("is packed from CONFIRMED, without ever having been paid", async () => {
    mocks.db.order.findUnique.mockResolvedValue({ paymentMethod: "COD" })
    expect(await markPacked("order-1")).toMatchObject({ ok: true, data: { status: "PACKED" } })
    expect(mocks.db.order.updateMany).toHaveBeenCalledWith({
      where: { id: "order-1", status: { in: ["PAID", "CONFIRMED", "PENDING"] } },
      data: { status: "PACKED" },
    })
  })

  it("never packs an online order that is still waiting for its payment", async () => {
    mocks.db.order.findUnique.mockResolvedValue({ paymentMethod: "PARTIAL" })
    await markPacked("order-1")
    const [claim] = mocks.db.order.updateMany.mock.calls[0]!
    expect(claim.where.status.in).not.toContain("PENDING")
  })

  it("is cancelled while unpaid, and called off in Shiprocket too", async () => {
    mocks.db.order.findUnique.mockResolvedValue({
      couponId: null,
      items: [{ variantId: "variant-1", qty: 2 }],
    })
    expect(await cancelOrder("order-1")).toMatchObject({ ok: true, data: { status: "CANCELLED" } })
    expect(mocks.db.order.updateMany).toHaveBeenCalledWith({
      where: { id: "order-1", status: { in: ["PENDING", "CONFIRMED"] } },
      data: { status: "CANCELLED" },
    })
    expect(mocks.cancelShiprocketOrder).toHaveBeenCalledWith("order-1", null)
  })

  it("leaves Shiprocket alone when the order could not be cancelled", async () => {
    mocks.db.order.updateMany.mockResolvedValue({ count: 0 })
    expect(await cancelOrder("order-1")).toMatchObject({ ok: false, status: 409 })
    expect(mocks.cancelShiprocketOrder).not.toHaveBeenCalled()
  })
})

describe("refundOrder", () => {
  const order = (over: object) => ({
    id: "order-1",
    total: "3599",
    status: "RETURNED",
    items: [],
    payments: [],
    ...over,
  })

  it("sends back through Razorpay only the advance that came through it", async () => {
    mocks.db.order.findUnique.mockResolvedValue(
      order({ payments: [{ gatewayPaymentId: "pay_1", mode: "live", amount: "720" }] }),
    )
    expect(await refundOrder("order-1")).toMatchObject({ ok: true, data: { status: "REFUNDED" } })
    expect(mocks.refundPayment).toHaveBeenCalledWith({
      gatewayPaymentId: "pay_1",
      amountRupees: "720",
      mode: "live",
    })
  })

  it("moves no money for cash on delivery, which Razorpay never saw", async () => {
    mocks.db.order.findUnique.mockResolvedValue(order({ status: "DELIVERED" }))
    expect(await refundOrder("order-1")).toMatchObject({ ok: true })
    expect(mocks.refundPayment).not.toHaveBeenCalled()
  })

  it("does not refund a cash-on-delivery order that is only confirmed: that is a cancel", async () => {
    mocks.db.order.findUnique.mockResolvedValue(order({ status: "CONFIRMED" }))
    expect(await refundOrder("order-1")).toMatchObject({ ok: false, status: 409 })
    expect(mocks.db.order.updateMany).not.toHaveBeenCalled()
  })
})
