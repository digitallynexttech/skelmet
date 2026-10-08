import { describe, expect, it } from "vitest"

import { buildInvoice, type InvoiceOrder } from "@/features/invoices/invoice"
import { renderInvoicePdf } from "@/features/invoices/server/invoice-pdf"

// Renders with the fonts and logo from assets/invoice, the folder the build traces.

const order: InvoiceOrder = {
  number: "SKM-2026-47MV",
  placedAt: new Date("2026-09-25T14:46:57Z"),
  invoiceNumber: "SKM/26-27/0001",
  invoicedAt: new Date("2026-09-26T06:00:00Z"),
  email: "rider@example.com",
  phone: "9582752626",
  address: {
    firstName: "Hemant",
    lastName: "Jangra",
    line1: "B-121, Sector 6",
    city: "Noida",
    state: "Delhi",
    pincode: "110044",
  },
  items: [{ name: "Flame Skull Helmet Mount", sku: "SKM-BLZ", qty: 1, unitPrice: 3499 }],
  discount: 0,
  shipping: 0,
  paymentFee: 0,
  total: 3499,
  couponCode: null,
  payment: { method: "ONLINE", reference: "pay_X" },
  shipment: null,
}

describe("renderInvoicePdf", () => {
  it("renders a tax invoice", async () => {
    const pdf = await renderInvoicePdf(buildInvoice(order))
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-")
    expect(pdf.length).toBeGreaterThan(5_000)
  })

  it("renders a credit note from the same amounts", async () => {
    const pdf = await renderInvoicePdf(buildInvoice(order), {
      kind: "credit-note",
      number: "CN/26-27/0001",
      date: new Date("2026-09-28T06:00:00Z"),
    })
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-")
  })
})
