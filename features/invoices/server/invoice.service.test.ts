import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => {
  const tx = { $queryRaw: vi.fn(), order: { update: vi.fn() } }
  return {
    tx,
    db: {
      $transaction: vi.fn(async (work: (t: typeof tx) => unknown) => work(tx)),
      order: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
      payment: { findFirst: vi.fn() },
    },
    createAuditLog: vi.fn(),
    later: vi.fn(),
    sendMail: vi.fn(),
    renderInvoicePdf: vi.fn(async () => Buffer.from("%PDF-1.3")),
  }
})

vi.mock("@/server/db", () => ({ db: mocks.db }))
vi.mock("@/lib/env", () => ({ hasDatabase: () => true }))
vi.mock("@/server/action-guard", () => ({ requirePermission: async () => ({ user: { id: "a" } }) }))
vi.mock("@/server/audit", () => ({
  createAuditLog: mocks.createAuditLog,
  getAuditMeta: async () => ({}),
}))
vi.mock("@/server/later", () => ({ later: mocks.later }))
vi.mock("@/lib/mailer", () => ({ sendMail: mocks.sendMail }))
vi.mock("@/features/invoices/server/invoice-pdf", () => ({
  renderInvoicePdf: mocks.renderInvoicePdf,
}))
vi.mock("@/features/settings/server/runtime-settings", () => ({
  paymentConfig: async () => ({ mode: "live", envMode: "live" }),
}))

const service = await import("@/features/invoices/server/invoice.service")
const { financialYear } = await import("@/features/invoices/invoice")

const ORDER = {
  number: "SKM-2026-AAAA",
  email: "rider@example.in",
  phone: "9876543210",
  paymentMethod: "ONLINE",
  shippingAddress: { firstName: "Asha", lastName: "Rao", city: "Jaipur", state: "Rajasthan" },
  discount: "0",
  shipping: "0",
  total: "3499",
  createdAt: new Date("2026-09-20"),
  placedAt: new Date("2026-09-20"),
  coupon: null,
  items: [{ nameSnapshot: "Mount", qty: 1, unitPrice: "3499", variant: { sku: "SKM-1" } }],
  payments: [{ gatewayPaymentId: "pay_1" }],
  shipment: null,
}

const row = (over: Record<string, unknown>) => ({
  invoice_number: null,
  invoiced_at: null,
  credit_note_number: null,
  credited_at: null,
  status: "PAID",
  ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
  mocks.db.$transaction.mockImplementation(async (work) => work(mocks.tx))
  mocks.db.payment.findFirst.mockResolvedValue({ mode: "live" })
  mocks.db.order.findUnique.mockImplementation(async (args: { select: Record<string, unknown> }) =>
    "number" in args.select ? ORDER : { invoiceNumber: "SKM/26-27/0001", creditNoteNumber: null },
  )
})

describe("the tax invoice", () => {
  it("is refused for a refunded order, even one invoiced before", async () => {
    mocks.tx.$queryRaw.mockResolvedValueOnce([
      row({
        invoice_number: "SKM/26-27/0001",
        invoiced_at: new Date("2026-09-21"),
        status: "REFUNDED",
      }),
    ])
    const result = await service.getInvoicePdf("order-1")
    expect(result).toMatchObject({ ok: false, status: 409 })
    expect(result.ok === false && result.error).toMatch(/credit note/)
    expect(mocks.renderInvoicePdf).not.toHaveBeenCalled()
  })

  it("is refused for a test-mode payment, before any number is taken", async () => {
    mocks.db.payment.findFirst.mockResolvedValue({ mode: "test" })
    expect(await service.emailInvoice("order-1")).toMatchObject({
      ok: false,
      status: 409,
      error: service.TEST_MODE_REFUSAL,
    })
    expect(mocks.db.$transaction).not.toHaveBeenCalled()
  })

  it("prints for a standing order", async () => {
    mocks.tx.$queryRaw.mockResolvedValueOnce([
      row({ invoice_number: "SKM/26-27/0001", invoiced_at: new Date("2026-09-21") }),
    ])
    expect(await service.getInvoicePdf("order-1")).toMatchObject({
      ok: true,
      data: { filename: "invoice-SKM-26-27-0001.pdf" },
    })
  })
})

describe("the credit note", () => {
  it("is numbered from its own counter when an invoiced order is refunded", async () => {
    mocks.tx.$queryRaw
      .mockResolvedValueOnce([
        row({
          invoice_number: "SKM/26-27/0001",
          invoiced_at: new Date("2026-09-21"),
          status: "REFUNDED",
        }),
      ])
      .mockResolvedValueOnce([{ last: 4 }])

    await service.creditNoteOnRefund("order-1", null)

    const fy = financialYear(new Date())
    const counter = mocks.tx.$queryRaw.mock.calls[1]!
    expect(counter.slice(1)).toContain(`CN-${fy}`)
    expect(mocks.tx.order.update).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: { creditNoteNumber: `CN/${fy}/0004`, creditedAt: expect.any(Date) },
    })
    expect(mocks.createAuditLog).toHaveBeenCalledWith(
      null,
      expect.objectContaining({ action: "order:credit-note" }),
    )
  })

  it("prints titled as a credit note, naming the invoice it cancels", async () => {
    mocks.tx.$queryRaw.mockResolvedValueOnce([
      row({
        invoice_number: "SKM/26-27/0001",
        invoiced_at: new Date("2026-09-21"),
        credit_note_number: "CN/26-27/0004",
        credited_at: new Date("2026-09-25"),
        status: "REFUNDED",
      }),
    ])
    const result = await service.getCreditNotePdf("order-1")
    expect(result).toMatchObject({ ok: true, data: { filename: "credit-note-CN-26-27-0004.pdf" } })
    const [invoice, as] = mocks.renderInvoicePdf.mock.calls[0]! as unknown as [
      { order: { invoiceNumber: string } },
      unknown,
    ]
    expect(invoice.order.invoiceNumber).toBe("SKM/26-27/0001")
    expect(as).toEqual({ kind: "credit-note", number: "CN/26-27/0004", date: expect.any(Date) })
  })

  it("is not issued for an order that was never invoiced", async () => {
    mocks.tx.$queryRaw.mockResolvedValueOnce([row({ status: "REFUNDED" })])
    await service.creditNoteOnRefund("order-1", null)
    expect(mocks.tx.order.update).not.toHaveBeenCalled()
  })
})

describe("the delivery email", () => {
  const run = async () => {
    service.queueInvoiceEmail("order-1")
    await mocks.later.mock.calls[0]![0]()
  }

  it("does not throw into after() when the claim itself fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    mocks.db.order.updateMany.mockRejectedValueOnce(new Error("db down"))
    await expect(run()).resolves.toBeUndefined()
    expect(mocks.createAuditLog).toHaveBeenCalledWith(
      null,
      expect.objectContaining({ action: "order:invoice-email-failed" }),
    )
  })

  it("hands the claim back and audits it when the mail does not go", async () => {
    mocks.db.order.updateMany.mockResolvedValue({ count: 1 })
    mocks.tx.$queryRaw.mockResolvedValueOnce([
      row({ invoice_number: "SKM/26-27/0001", invoiced_at: new Date("2026-09-21") }),
    ])
    mocks.sendMail.mockResolvedValue({ ok: false, delivered: false, error: "421 try later" })

    await run()

    expect(mocks.db.order.updateMany).toHaveBeenLastCalledWith({
      where: { id: "order-1" },
      data: { invoiceEmailedAt: null },
    })
    expect(mocks.createAuditLog).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        action: "order:invoice-email-failed",
        meta: expect.objectContaining({ error: "421 try later" }),
      }),
    )
  })
})
