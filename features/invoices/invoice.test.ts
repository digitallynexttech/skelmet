import { describe, expect, it } from "vitest"

import {
  buildInvoice,
  financialYear,
  invoiceNumber,
  type InvoiceOrder,
} from "@/features/invoices/invoice"
import { rupeesInWords } from "@/lib/amount-in-words"

const order = (over: Partial<InvoiceOrder> = {}): InvoiceOrder => ({
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
  items: [
    { name: "Flame Skull Helmet Mount - Blaze Orange", sku: "SKM-BLZ", qty: 1, unitPrice: 3499 },
  ],
  discount: 0,
  shipping: 0,
  total: 3499,
  couponCode: null,
  payment: { method: "ONLINE", reference: "pay_X" },
  shipment: null,
  ...over,
})

describe("buildInvoice", () => {
  it("takes GST back out of an inclusive price, as IGST outside Uttar Pradesh", () => {
    const inv = buildInvoice(order())
    expect(inv.taxable).toBe(2965.25)
    expect(inv.interState).toBe(true)
    expect(inv.taxes).toEqual([{ label: "IGST", ratePercent: 18, amount: 533.75 }])
    expect(inv.taxable + inv.totalTax).toBe(3499)
    expect(inv.placeOfSupply).toEqual({ state: "Delhi", code: "07" })
  })

  it("splits it into CGST and SGST within Uttar Pradesh", () => {
    const inv = buildInvoice(order({ address: { ...order().address, state: "Uttar Pradesh" } }))
    expect(inv.interState).toBe(false)
    expect(inv.taxes.map((t) => [t.label, t.ratePercent])).toEqual([
      ["CGST", 9],
      ["SGST", 9],
    ])
    expect(inv.taxes[0]!.amount + inv.taxes[1]!.amount).toBeCloseTo(inv.totalTax, 2)
  })

  it("always totals exactly what the customer paid, with shipping and a discount", () => {
    const inv = buildInvoice(
      order({
        items: [
          { name: "Blaze", sku: "SKM-BLZ", qty: 2, unitPrice: 3499 },
          { name: "Olive", sku: "SKM-OLV", qty: 1, unitPrice: 3499 },
        ],
        shipping: 62,
        discount: 500,
        couponCode: "RIDE500",
        total: 3499 * 3 + 62 - 500,
      }),
    )
    expect(inv.rows.map((r) => r.description)).toEqual([
      "Blaze",
      "Olive",
      "Shipping charges",
      "Discount (RIDE500)",
    ])
    expect(inv.rows.at(-1)!.amount).toBeLessThan(0)
    expect(Math.round((inv.taxable + inv.totalTax) * 100)).toBe((3499 * 3 + 62 - 500) * 100)
    expect(inv.totalQty).toBe(3)
  })

  it("handles a Rs 1 order", () => {
    const inv = buildInvoice(order({ discount: 3498, couponCode: "SKULL1000", total: 1 }))
    expect(inv.taxable + inv.totalTax).toBeCloseTo(1, 2)
    expect(inv.amountInWords).toBe("Rupees One Only")
  })
})

describe("rupeesInWords", () => {
  it("writes amounts the way the invoice does", () => {
    expect(rupeesInWords(6726)).toBe("Rupees Six Thousand Seven Hundred Twenty Six Only")
    expect(rupeesInWords(1026)).toBe("Rupees One Thousand Twenty Six Only")
    expect(rupeesInWords(533.75)).toBe(
      "Rupees Five Hundred Thirty Three and Seventy Five Paise Only",
    )
    expect(rupeesInWords(12_50_000)).toBe("Rupees Twelve Lakh Fifty Thousand Only")
    expect(rupeesInWords(2_03_45_678)).toBe(
      "Rupees Two Crore Three Lakh Forty Five Thousand Six Hundred Seventy Eight Only",
    )
  })
})

describe("invoice numbers", () => {
  it("follow India's April-to-March financial year, in Indian time", () => {
    expect(financialYear(new Date("2026-09-25T10:00:00Z"))).toBe("26-27")
    expect(financialYear(new Date("2027-02-10T10:00:00Z"))).toBe("26-27")
    // 31 March 23:00 UTC is already 1 April in India.
    expect(financialYear(new Date("2027-03-31T23:00:00Z"))).toBe("27-28")
    expect(invoiceNumber("26-27", 7)).toBe("SKM/26-27/0007")
  })
})
