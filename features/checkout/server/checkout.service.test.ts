import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Checkout's guarantees about money and stock: what refuses an order, what a
 * lost race answers, when an order counts as paid, and that an abandoned
 * order is never cancelled while Razorpay may be holding its money.
 */

const mocks = vi.hoisted(() => {
  const db = {
    order: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    variant: { findMany: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
    coupon: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
      fields: { maxUses: { name: "maxUses" } },
    },
    payment: { create: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
    $transaction: vi.fn(),
  }
  return {
    db,
    gateway: {
      captureGatewayPayment: vi.fn(),
      createGatewayOrder: vi.fn(),
      fetchOrderPayments: vi.fn(),
      fetchPayment: vi.fn(),
      isGatewayConfigured: vi.fn(),
      verifyPaymentSignature: vi.fn(),
    },
    checkPincode: vi.fn(),
    queueShiprocketOrder: vi.fn(),
    attachCustomer: vi.fn(),
    rememberCustomerDetails: vi.fn(),
    createAuditLog: vi.fn(),
    sendMail: vi.fn(),
    later: vi.fn(),
  }
})

vi.mock("@/server/db", () => ({ db: mocks.db }))
vi.mock("@/lib/env", () => ({ hasDatabase: () => true }))
vi.mock("@/features/checkout/server/payment-gateway", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/checkout/server/payment-gateway")>()
  return {
    ...actual,
    ...mocks.gateway,
  }
})
vi.mock("@/features/settings/server/runtime-settings", () => ({
  paymentConfig: async () => ({
    mode: "test",
    envMode: "test",
    test: { keyId: "rzp_test_x", keySecret: "s", webhookSecret: null },
    live: { keyId: null, keySecret: null, webhookSecret: null },
  }),
}))
vi.mock("@/features/customers/server/customers.service", () => ({
  attachCustomer: mocks.attachCustomer,
  rememberCustomerDetails: mocks.rememberCustomerDetails,
}))
vi.mock("@/features/checkout/server/recent-order", () => ({
  rememberOrder: vi.fn(),
  rememberedOrder: vi.fn(),
}))
vi.mock("@/features/shipping/server/shipping.service", () => ({
  checkPincode: mocks.checkPincode,
  queueShiprocketOrder: mocks.queueShiprocketOrder,
}))
vi.mock("@/features/visitors/server/tracking.service", () => ({ attachOrderToVisitor: vi.fn() }))
vi.mock("@/lib/mailer", () => ({ sendMail: mocks.sendMail }))
vi.mock("@/server/audit", () => ({
  createAuditLog: mocks.createAuditLog,
  getAuditMeta: async () => ({ ip: "198.51.100.1", userAgent: "test" }),
}))
vi.mock("@/server/action-guard", () => ({ optionalSession: async () => null }))
vi.mock("@/server/later", () => ({ later: mocks.later }))

const service = await import("@/features/checkout/server/checkout.service")
const { AppError } = await import("@/lib/errors")

const VARIANT = {
  id: "variant-1",
  sku: "SKM-FLAME-ORANGE",
  price: "3499",
  stock: 10,
  colourway: "orange",
  product: { name: "Flame Skull Mount", status: "ACTIVE" },
}

const ORDER_INPUT = {
  email: "Rider@Example.in",
  phone: "9876543210",
  address: {
    firstName: "Asha",
    lastName: "Rao",
    line1: "12 MG Road",
    city: "Jaipur",
    state: "Rajasthan",
    pincode: "302001",
  },
  items: [{ sku: "SKM-FLAME-ORANGE", qty: 1 }],
}

const signed = {
  orderId: "5f6e7d8c-9b0a-4c1d-8e2f-3a4b5c6d7e8f",
  gatewayOrderId: "order_RZ1",
  gatewayPaymentId: "pay_RZ1",
  signature: "sig",
}

beforeEach(() => {
  vi.clearAllMocks()
  const db = mocks.db
  db.$transaction.mockImplementation(async (work: unknown) =>
    typeof work === "function" ? (work as (tx: typeof db) => unknown)(db) : Promise.all(work as []),
  )
  db.order.count.mockResolvedValue(0)
  db.order.findMany.mockResolvedValue([])
  db.order.create.mockResolvedValue({ id: "order-1", number: "SKM-2026-AAAA", total: "3499" })
  db.variant.findMany.mockResolvedValue([VARIANT])
  db.variant.updateMany.mockResolvedValue({ count: 1 })
  db.coupon.updateMany.mockResolvedValue({ count: 1 })
  db.payment.findUnique.mockResolvedValue({ id: "payment-1", orderId: "order-1", mode: "test" })
  db.payment.updateMany.mockResolvedValue({ count: 1 })
  db.order.updateMany.mockResolvedValue({ count: 1 })
  db.order.findUnique.mockResolvedValue({
    number: "SKM-2026-AAAA",
    status: "PAID",
    email: "rider@example.in",
    total: "3499",
    couponId: null,
    items: [{ nameSnapshot: "Flame Skull Mount · orange", qty: 1 }],
  })

  mocks.checkPincode.mockResolvedValue({
    ok: true,
    data: { live: false, serviceable: true, found: true, shippingFee: 0 },
  })
  mocks.attachCustomer.mockResolvedValue("customer-1")
  mocks.gateway.isGatewayConfigured.mockResolvedValue(true)
  mocks.gateway.createGatewayOrder.mockResolvedValue({
    order: { id: "order_RZ1" },
    keyId: "rzp_test_x",
    mode: "test",
  })
  mocks.gateway.verifyPaymentSignature.mockResolvedValue(true)
  mocks.gateway.fetchPayment.mockResolvedValue({
    id: "pay_RZ1",
    status: "captured",
    amount: 349_900,
    order_id: "order_RZ1",
  })
})

describe("isDuplicateNumber", () => {
  const p2002 = (message: string, meta?: unknown) =>
    Object.assign(new Error(message), { code: "P2002", meta })

  it("recognises a clash on the order number in every shape Prisma sends it", () => {
    // Prisma 5/6.
    expect(
      service.isDuplicateNumber(p2002("Unique constraint failed", { target: ["number"] })),
    ).toBe(true)
    // Prisma 7 driver adapters: no `target`, the column under driverAdapterError.
    expect(
      service.isDuplicateNumber(
        p2002("Unique constraint failed on the fields: (`number`)", {
          modelName: "Order",
          driverAdapterError: {
            cause: { kind: "UniqueConstraintViolation", constraint: { fields: ["number"] } },
          },
        }),
      ),
    ).toBe(true)
    // Only the index name.
    expect(
      service.isDuplicateNumber(
        p2002("x", {
          driverAdapterError: { cause: { constraint: { index: "orders_number_key" } } },
        }),
      ),
    ).toBe(true)
  })

  it("never retries a different unique index or a different error", () => {
    expect(service.isDuplicateNumber(p2002("x", { target: ["email"] }))).toBe(false)
    expect(
      service.isDuplicateNumber(
        p2002("Unique constraint failed on the fields: (`invoice_number`)", {
          target: ["invoice_number"],
        }),
      ),
    ).toBe(false)
    expect(service.isDuplicateNumber(Object.assign(new Error("number"), { code: "P2025" }))).toBe(
      false,
    )
    expect(service.isDuplicateNumber("P2002 number")).toBe(false)
  })
})

describe("placeOrder", () => {
  it("places an order, recording only who bought - not their address - on the customer", async () => {
    const result = await service.placeOrder(ORDER_INPUT)
    expect(result).toMatchObject({ ok: true, data: { orderNumber: "SKM-2026-AAAA" } })
    expect(mocks.attachCustomer).toHaveBeenCalledWith(mocks.db, { email: "rider@example.in" })
  })

  it("refuses a fourth unpaid order from the same email or phone, before asking Shiprocket", async () => {
    mocks.db.order.count.mockResolvedValue(3)
    const result = await service.placeOrder(ORDER_INPUT)
    expect(result).toMatchObject({ ok: false, status: 409 })
    expect(mocks.checkPincode).not.toHaveBeenCalled()
    expect(mocks.db.order.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        status: "PENDING",
        paymentMethod: "ONLINE",
        OR: [{ email: "rider@example.in" }, { phone: "9876543210" }],
      }),
    })
  })

  it("does not sell a product that is not ACTIVE", async () => {
    for (const status of ["DRAFT", "ARCHIVED"]) {
      mocks.db.variant.findMany.mockResolvedValue([
        { ...VARIANT, product: { ...VARIANT.product, status } },
      ])
      expect(await service.placeOrder(ORDER_INPUT)).toMatchObject({ ok: false, status: 409 })
    }
    expect(mocks.db.order.create).not.toHaveBeenCalled()
  })

  it("answers a lost stock race with 409, not 500", async () => {
    mocks.db.variant.updateMany.mockResolvedValue({ count: 0 })
    const result = await service.placeOrder(ORDER_INPUT)
    expect(result).toMatchObject({ ok: false, status: 409 })
    expect(result.ok === false && result.error).toMatch(/just bought the last/)
  })

  it("retries with a fresh number when the order number clashes", async () => {
    mocks.db.$transaction
      .mockImplementationOnce(async () => {
        throw Object.assign(new Error("Unique constraint failed on the fields: (`number`)"), {
          code: "P2002",
          meta: { modelName: "Order" },
        })
      })
      .mockImplementation(async (work: unknown) =>
        (work as (tx: typeof mocks.db) => unknown)(mocks.db),
      )
    expect(await service.placeOrder(ORDER_INPUT)).toMatchObject({ ok: true })
  })

  describe("with a coupon", () => {
    const coupon = (over: Record<string, unknown> = {}) => ({
      id: "coupon-1",
      kind: "FLAT",
      value: "500",
      minSubtotal: "0",
      maxUses: 10,
      usedCount: 0,
      expiresAt: null,
      ...over,
    })
    const withCode = { ...ORDER_INPUT, couponCode: "RIDE500" }

    it("gives one answer for a missing, expired or used-up code", async () => {
      for (const found of [
        null,
        coupon({ expiresAt: new Date(Date.now() - 1_000) }),
        coupon({ maxUses: 5, usedCount: 5 }),
      ]) {
        mocks.db.coupon.findUnique.mockResolvedValueOnce(found)
        expect(await service.placeOrder(withCode)).toEqual({
          ok: false,
          error: "This code can't be used.",
          status: 422,
          details: undefined,
        })
      }
    })

    it("says what the minimum spend is, with Indian separators", async () => {
      mocks.db.coupon.findUnique.mockResolvedValue(coupon({ minSubtotal: "150000" }))
      expect(await service.placeOrder(withCode)).toMatchObject({
        ok: false,
        error: "Spend at least ₹1,50,000 to use that code.",
      })
    })

    it("claims the use inside the transaction, and refuses with 409 when it is gone", async () => {
      mocks.db.coupon.findUnique.mockResolvedValue(coupon())
      mocks.db.coupon.updateMany.mockResolvedValue({ count: 0 })

      const result = await service.placeOrder(withCode)
      expect(result).toMatchObject({ ok: false, status: 409 })
      expect(mocks.db.coupon.updateMany).toHaveBeenCalledWith({
        where: {
          id: "coupon-1",
          AND: [
            { OR: [{ expiresAt: null }, { expiresAt: { gt: expect.any(Date) } }] },
            { OR: [{ maxUses: null }, { usedCount: { lt: mocks.db.coupon.fields.maxUses } }] },
          ],
        },
        data: { usedCount: { increment: 1 } },
      })
    })
  })
})

describe("confirmPayment", () => {
  it("logs a bad signature once, without any id the caller sent", async () => {
    mocks.gateway.verifyPaymentSignature.mockResolvedValue(false)
    expect(await service.confirmPayment(signed)).toMatchObject({ ok: false, status: 422 })
    expect(mocks.createAuditLog).toHaveBeenCalledTimes(1)
    const [, entry] = mocks.createAuditLog.mock.calls[0]!
    expect(entry).toEqual({
      action: "payment:signature-invalid",
      module: "order",
      ip: "198.51.100.1",
      userAgent: "test",
    })
  })

  it("marks the order paid once Razorpay says captured, and mails the receipt after the response", async () => {
    expect(await service.confirmPayment(signed)).toMatchObject({
      ok: true,
      data: { orderNumber: "SKM-2026-AAAA" },
    })
    expect(mocks.db.order.updateMany).toHaveBeenCalledWith({
      where: { id: "order-1", status: "PENDING" },
      data: { status: "PAID", placedAt: expect.any(Date) },
    })
    expect(mocks.sendMail).not.toHaveBeenCalled()
    expect(mocks.later).toHaveBeenCalledTimes(1)
    await mocks.later.mock.calls[0]![0]()
    expect(mocks.sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: "rider@example.in" }))
    expect(mocks.rememberCustomerDetails).toHaveBeenCalledWith("order-1")
  })

  it("captures a payment that is only authorised before marking it paid", async () => {
    mocks.gateway.fetchPayment.mockResolvedValue({
      id: "pay_RZ1",
      status: "authorized",
      amount: 349_900,
      order_id: "order_RZ1",
    })
    await service.confirmPayment(signed)
    expect(mocks.gateway.captureGatewayPayment).toHaveBeenCalledWith(
      expect.objectContaining({ id: "pay_RZ1", amount: 349_900 }),
      "test",
    )
    expect(mocks.db.payment.updateMany).toHaveBeenCalled()
  })

  it("does not mark paid on a signature alone when Razorpay says it did not go through", async () => {
    mocks.gateway.fetchPayment.mockResolvedValue({
      id: "pay_RZ1",
      status: "failed",
      amount: 349_900,
      order_id: "order_RZ1",
    })
    expect(await service.confirmPayment(signed)).toMatchObject({ ok: false, status: 409 })
    expect(mocks.db.payment.updateMany).not.toHaveBeenCalled()
  })

  it("falls back to the signature, and audits it, when Razorpay cannot be reached", async () => {
    mocks.gateway.fetchPayment.mockRejectedValue(new AppError("Razorpay did not answer.", 504))
    expect(await service.confirmPayment(signed)).toMatchObject({ ok: true })
    expect(mocks.createAuditLog).toHaveBeenCalledWith(
      null,
      expect.objectContaining({ action: "payment:confirmed-by-signature-only" }),
    )
  })
})

describe("releaseStaleOrders", () => {
  const stale = {
    id: "order-9",
    number: "SKM-2026-OLD9",
    couponId: null,
    items: [{ variantId: "variant-1", qty: 1 }],
    payments: [{ gatewayOrderId: "order_RZ9", mode: "test" }],
  }

  beforeEach(() => {
    mocks.db.order.findMany.mockResolvedValue([stale])
    mocks.db.payment.findUnique.mockResolvedValue({ id: "payment-9", orderId: "order-9" })
  })

  it("marks paid, not cancelled, an order Razorpay captured money for", async () => {
    mocks.gateway.fetchOrderPayments.mockResolvedValue([
      { id: "pay_declined", status: "failed", amount: 1 },
      { id: "pay_ok", status: "captured", amount: 349_900 },
    ])
    await service.releaseStaleOrders()

    expect(mocks.db.payment.updateMany).toHaveBeenCalledWith({
      where: { id: "payment-9", status: { in: ["CREATED", "AUTHORIZED", "FAILED"] } },
      data: { status: "CAPTURED", gatewayPaymentId: "pay_ok" },
    })
    expect(mocks.db.order.updateMany).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "CANCELLED" } }),
    )
  })

  it("leaves the order alone when Razorpay cannot be asked", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    mocks.gateway.fetchOrderPayments.mockRejectedValue(
      new AppError("Razorpay did not answer.", 504),
    )
    await service.releaseStaleOrders()
    expect(mocks.db.order.updateMany).not.toHaveBeenCalled()
    expect(mocks.db.variant.update).not.toHaveBeenCalled()

    // And does not ask about it again on the very next run.
    mocks.gateway.fetchOrderPayments.mockClear()
    await service.releaseStaleOrders()
    expect(mocks.db.order.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { notIn: ["order-9"] } }),
      }),
    )
  })

  it("cancels and restocks an order nobody paid for", async () => {
    mocks.db.order.findMany.mockResolvedValue([{ ...stale, id: "order-10" }])
    mocks.gateway.fetchOrderPayments.mockResolvedValue([{ id: "p", status: "failed", amount: 1 }])
    await service.releaseStaleOrders()
    expect(mocks.db.order.updateMany).toHaveBeenCalledWith({
      where: { id: "order-10", status: "PENDING" },
      data: { status: "CANCELLED" },
    })
    expect(mocks.db.variant.update).toHaveBeenCalledWith({
      where: { id: "variant-1" },
      data: { stock: { increment: 1 } },
    })
  })
})

describe("a payment landing on a cancelled order", () => {
  it("revives it, and counts a coupon that ran out meanwhile rather than dropping the use", async () => {
    mocks.db.order.updateMany.mockResolvedValue({ count: 0 })
    mocks.db.order.findUnique
      .mockResolvedValueOnce({
        status: "CANCELLED",
        couponId: "coupon-1",
        items: [{ variantId: "variant-1", qty: 1 }],
      })
      .mockResolvedValue({
        number: "SKM-2026-AAAA",
        status: "PAID",
        email: "rider@example.in",
        total: "2999",
        couponId: "coupon-1",
        items: [],
      })
    mocks.db.coupon.updateMany.mockResolvedValue({ count: 0 })

    await service.applyPaymentWebhook({
      event: "payment.captured",
      payload: { payment: { entity: { id: "pay_RZ1", order_id: "order_RZ1" } } },
    })

    expect(mocks.db.coupon.update).toHaveBeenCalledWith({
      where: { id: "coupon-1" },
      data: { usedCount: { increment: 1 } },
    })
    expect(mocks.createAuditLog).toHaveBeenCalledWith(
      null,
      expect.objectContaining({ action: "coupon:over-limit" }),
    )
  })
})
