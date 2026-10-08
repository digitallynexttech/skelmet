import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  db: {
    order: { findMany: vi.fn(), deleteMany: vi.fn() },
    variant: { update: vi.fn() },
    coupon: { updateMany: vi.fn() },
    $transaction: vi.fn(),
  },
  cancelShiprocketOrder: vi.fn(),
  createAuditLog: vi.fn(),
}))

vi.mock("@/server/db", () => ({ db: mocks.db }))
vi.mock("@/lib/env", () => ({ hasDatabase: () => true }))
vi.mock("@/server/action-guard", () => ({ requireFullAccess: async () => ({ user: { id: "a" } }) }))
vi.mock("@/server/audit", () => ({ createAuditLog: mocks.createAuditLog }))
vi.mock("@/features/checkout/server/payment-gateway", () => ({
  modeOfPayment: (mode: string | null, config: { envMode: string | null; mode: string }) =>
    mode ?? config.envMode ?? config.mode,
}))
vi.mock("@/features/settings/server/runtime-settings", () => ({
  paymentConfig: async () => ({ envMode: null, mode: "live" }),
}))
vi.mock("@/features/shipping/server/shipping.service", () => ({
  cancelShiprocketOrder: mocks.cancelShiprocketOrder,
}))

const { deleteTestOrders } = await import("@/features/orders/server/test-orders")
const { whyKeep } = await import("@/features/orders/server/test-order-rules")

const ID = (n: number) => `00000000-0000-4000-8000-00000000000${n}`

const order = (n: number, over: Record<string, unknown> = {}) => ({
  id: ID(n),
  number: `SKM-${n}`,
  status: "PAID",
  paymentMethod: "ONLINE",
  total: { toString: () => "3499.00" },
  invoiceNumber: null,
  creditNoteNumber: null,
  shiprocketOrderId: null,
  couponId: null,
  shippingAddress: { firstName: "Test" },
  items: [{ variantId: "v1", qty: 1 }],
  payments: [{ status: "CAPTURED", mode: "test" }],
  shipment: null,
  ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
  mocks.db.order.deleteMany.mockResolvedValue({ count: 1 })
  mocks.db.$transaction.mockImplementation(async (fn: (tx: typeof mocks.db) => unknown) =>
    fn(mocks.db),
  )
})

describe("whyKeep", () => {
  const base = {
    status: "PAID" as const,
    paymentMethod: "ONLINE" as const,
    invoiceNumber: null,
    creditNoteNumber: null,
    moneyModes: ["test" as const],
    shipment: null,
  }

  it("lets a test-mode order go", () => {
    expect(whyKeep(base)).toBeNull()
  })

  it("keeps anything paid with real money, even refunded", () => {
    expect(whyKeep({ ...base, moneyModes: ["live"] })).toMatch(/real money/)
    expect(whyKeep({ ...base, status: "REFUNDED", moneyModes: ["live"] })).toMatch(/real money/)
  })

  it("keeps cash collected at the door, an invoice number and a parcel on its way", () => {
    expect(whyKeep({ ...base, paymentMethod: "COD", status: "DELIVERED", moneyModes: [] })).toMatch(
      /cash/,
    )
    expect(whyKeep({ ...base, invoiceNumber: "SKM/26-27/0001" })).toMatch(/gap/)
    expect(whyKeep({ ...base, shipment: { provider: "shiprocket", stage: "in_transit" } })).toMatch(
      /courier/,
    )
  })

  it("keeps an order whose payment may still arrive", () => {
    expect(whyKeep({ ...base, status: "PENDING", moneyModes: [] })).toMatch(/waiting/)
  })
})

describe("deleteTestOrders", () => {
  it("deletes nothing without confirm, and says what it would do", async () => {
    mocks.db.order.findMany.mockResolvedValue([
      order(1),
      order(2, { payments: [{ status: "CAPTURED", mode: "live" }] }),
    ])
    const result = await deleteTestOrders({ ids: [ID(1), ID(2)] })
    expect(result).toMatchObject({
      ok: true,
      data: {
        deleted: false,
        deletable: [{ number: "SKM-1", testPayment: true }],
        kept: [{ number: "SKM-2" }],
      },
    })
    expect(mocks.db.order.deleteMany).not.toHaveBeenCalled()
  })

  it("never deletes a live-money order, even when ticked and confirmed", async () => {
    mocks.db.order.findMany.mockResolvedValue([
      order(1),
      order(2, { payments: [{ status: "REFUNDED", mode: "live" }], status: "REFUNDED" }),
    ])
    await deleteTestOrders({ ids: [ID(1), ID(2)], confirm: true })
    expect(mocks.db.order.deleteMany).toHaveBeenCalledTimes(1)
    expect(mocks.db.order.deleteMany).toHaveBeenCalledWith({
      where: { id: ID(1), status: "PAID" },
    })
  })

  it("puts back stock and a coupon use the order still held", async () => {
    mocks.db.order.findMany.mockResolvedValue([order(1, { couponId: "c1" })])
    await deleteTestOrders({ ids: [ID(1)], confirm: true })
    expect(mocks.db.variant.update).toHaveBeenCalledWith({
      where: { id: "v1" },
      data: { stock: { increment: 1 } },
    })
    expect(mocks.db.coupon.updateMany).toHaveBeenCalled()
    expect(mocks.createAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "order:delete", entityId: ID(1) }),
    )
  })

  it("restocks nothing a cancellation already gave back", async () => {
    mocks.db.order.findMany.mockResolvedValue([
      order(1, { status: "CANCELLED", payments: [], couponId: "c1" }),
    ])
    await deleteTestOrders({ ids: [ID(1)], confirm: true })
    expect(mocks.db.order.deleteMany).toHaveBeenCalled()
    expect(mocks.db.variant.update).not.toHaveBeenCalled()
    expect(mocks.db.coupon.updateMany).not.toHaveBeenCalled()
  })

  it("leaves an order that changed since it was read", async () => {
    mocks.db.order.findMany.mockResolvedValue([order(1)])
    mocks.db.order.deleteMany.mockResolvedValue({ count: 0 })
    const result = await deleteTestOrders({ ids: [ID(1)], confirm: true })
    expect(result).toMatchObject({ ok: true, data: { deletable: [], kept: [{ number: "SKM-1" }] } })
    expect(mocks.db.variant.update).not.toHaveBeenCalled()
  })
})
