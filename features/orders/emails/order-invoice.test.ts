import { describe, expect, it } from "vitest"

import { renderOrderInvoice } from "@/features/orders/emails/order-invoice"

const base = {
  number: "SKM-2026-47MV",
  invoiceNumber: "SKM/26-27/0001",
  firstName: "Hemant",
  total: "6,998.00",
}

describe("renderOrderInvoice", () => {
  it("puts the order number in the subject", () => {
    expect(renderOrderInvoice(base).subject).toBe("Your invoice for order SKM-2026-47MV")
  })

  it("carries the invoice number in both parts", () => {
    const m = renderOrderInvoice(base)
    for (const body of [m.text, m.html]) expect(body).toContain("SKM/26-27/0001")
  })

  it("states the amount in rupees the same way in both parts", () => {
    const m = renderOrderInvoice(base)
    for (const body of [m.text, m.html.replace("&#8377;", "₹")]) {
      expect(body).toContain("₹6,998.00")
    }
    expect(m.text).not.toMatch(/\bRs\b/)
  })

  it("escapes what it interpolates", () => {
    const m = renderOrderInvoice({ ...base, firstName: "<b>x</b>" })
    expect(m.html).not.toContain("<b>x</b>")
  })
})
