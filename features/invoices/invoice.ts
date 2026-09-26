import { invoiceConfig } from "@/config/invoice"
import { rupeesInWords } from "@/lib/amount-in-words"
import { GST_STATE_CODE, matchState } from "@/lib/india"

/**
 * A tax invoice for one order, worked out from what the customer paid.
 *
 * Prices on the site include GST, so nothing is added on top: every amount
 * the order charged - each line, shipping, less the discount - is taken back
 * to its value before tax, and the tax is the rest. The invoice total is
 * therefore always exactly the order total, to the paisa.
 *
 * Tax is IGST when the goods go to another state than the seller's, and CGST
 * plus SGST, half each, within it - decided by the delivery address, which is
 * the place of supply.
 */

export type InvoiceOrder = {
  number: string
  placedAt: Date
  invoiceNumber: string
  invoicedAt: Date
  email: string
  phone: string
  address: {
    firstName: string
    lastName: string
    line1: string
    line2?: string
    city: string
    state: string
    pincode: string
  }
  items: Array<{ name: string; sku: string; qty: number; unitPrice: number }>
  discount: number
  shipping: number
  total: number
  couponCode: string | null
  payment: { method: "ONLINE" | "COD"; reference: string | null }
  shipment: { courier: string; awb: string | null } | null
}

/** One line of the goods table, before tax. A discount is a negative line. */
export type InvoiceRow = {
  description: string
  hsn: string | null
  qty: number | null
  rate: number | null
  amount: number
}

export type InvoiceTax = { label: "IGST" | "CGST" | "SGST"; ratePercent: number; amount: number }

export type Invoice = {
  order: InvoiceOrder
  rows: InvoiceRow[]
  totalQty: number
  /** Before tax: the sum of the rows. */
  taxable: number
  interState: boolean
  taxes: InvoiceTax[]
  totalTax: number
  total: number
  placeOfSupply: { state: string; code: string | null }
  amountInWords: string
  taxInWords: string
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

export function buildInvoice(order: InvoiceOrder): Invoice {
  const rate = invoiceConfig.gstRatePercent
  const beforeTax = (inclusive: number) => round2(inclusive / (1 + rate / 100))

  // Amount is rate x qty, so the line reads true; any paisa of rounding
  // lands in the tax, which is whatever the total leaves.
  const rows: InvoiceRow[] = order.items.map((item) => {
    const unit = beforeTax(item.unitPrice)
    return {
      description: item.name,
      hsn: invoiceConfig.hsn,
      qty: item.qty,
      rate: unit,
      amount: round2(unit * item.qty),
    }
  })
  if (order.shipping > 0) {
    rows.push({
      description: "Shipping charges",
      hsn: null,
      qty: null,
      rate: null,
      amount: beforeTax(order.shipping),
    })
  }
  if (order.discount > 0) {
    rows.push({
      description: order.couponCode ? `Discount (${order.couponCode})` : "Discount",
      hsn: null,
      qty: null,
      rate: null,
      amount: -beforeTax(order.discount),
    })
  }

  const taxable = round2(rows.reduce((sum, row) => sum + row.amount, 0))
  const totalTax = round2(order.total - taxable)

  const state = matchState(order.address.state)
  const code = state ? GST_STATE_CODE[state] : null
  // Unknown state: treated as within the seller's own, the cautious reading.
  const interState = code !== null && code !== invoiceConfig.seller.stateCode

  let taxes: InvoiceTax[]
  if (interState) {
    taxes = [{ label: "IGST", ratePercent: rate, amount: totalTax }]
  } else {
    const cgst = round2(totalTax / 2)
    taxes = [
      { label: "CGST", ratePercent: rate / 2, amount: cgst },
      { label: "SGST", ratePercent: rate / 2, amount: round2(totalTax - cgst) },
    ]
  }

  return {
    order,
    rows,
    totalQty: order.items.reduce((n, item) => n + item.qty, 0),
    taxable,
    interState,
    taxes,
    totalTax,
    total: order.total,
    placeOfSupply: { state: state ?? order.address.state, code },
    amountInWords: rupeesInWords(order.total),
    taxInWords: rupeesInWords(totalTax),
  }
}

/**
 * The financial year an invoice falls in, as numbers carry it: April to March,
 * in India's time. 25 Sep 2026 -> "26-27", 10 Feb 2027 -> "26-27".
 */
export function financialYear(date: Date): string {
  const ist = new Date(date.getTime() + 5.5 * 60 * 60_000)
  const year = ist.getUTCFullYear()
  const start = ist.getUTCMonth() >= 3 ? year : year - 1
  return `${String(start % 100).padStart(2, "0")}-${String((start + 1) % 100).padStart(2, "0")}`
}

export function invoiceNumber(fy: string, sequence: number): string {
  return `${invoiceConfig.numberPrefix}/${fy}/${String(sequence).padStart(4, "0")}`
}
