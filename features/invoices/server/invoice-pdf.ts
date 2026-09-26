import "server-only"

import path from "node:path"

import PDFDocument from "pdfkit"

import { invoiceConfig } from "@/config/invoice"
import { siteConfig } from "@/config/site"
import type { Invoice } from "@/features/invoices/invoice"

/**
 * The tax invoice as an A4 PDF, laid out as Gee Star Spinning Solutions' own
 * invoices are - seller and invoice details at the top, the buyer, the goods
 * with the tax beneath them, the amount in words, the HSN-wise tax summary,
 * the declaration and the signatory - with the SKELMET mark above the seller.
 *
 * Noto Sans is embedded because the PDF standard fonts have no rupee sign.
 */

const ASSETS = path.join(process.cwd(), "assets")
const FONT = path.join(ASSETS, "fonts", "NotoSans-Regular.ttf")
const BOLD = path.join(ASSETS, "fonts", "NotoSans-Bold.ttf")
const LOGO = path.join(ASSETS, "skelmet-lockup-ink.png")

const INK = "#111114"
const DIM = "#5b5b66"
const LINE = "#6b6b75"

const money = (n: number) =>
  new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)

/** 26-Sep-26, as the Gee Star invoices date things, in India's time. */
const day = (d: Date) => {
  const part = (o: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-GB", { ...o, timeZone: "Asia/Kolkata" }).format(d)
  return `${part({ day: "2-digit" })}-${part({ month: "short" }).slice(0, 3)}-${part({ year: "2-digit" })}`
}

export function renderInvoicePdf(inv: Invoice): Promise<Buffer> {
  const doc = new PDFDocument({
    size: "A4",
    margin: 24,
    info: {
      Title: `Tax Invoice ${inv.order.invoiceNumber}`,
      Author: invoiceConfig.seller.name,
      Subject: `Order ${inv.order.number}`,
    },
  })
  doc.registerFont("r", FONT)
  doc.registerFont("b", BOLD)

  const chunks: Buffer[] = []
  doc.on("data", (c: Buffer) => chunks.push(c))
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)))
    doc.on("error", reject)
  })

  const X0 = 24
  const X1 = doc.page.width - 24
  const W = X1 - X0
  const { order } = inv
  const seller = invoiceConfig.seller

  const text = (
    s: string,
    x: number,
    y: number,
    o: {
      w?: number
      size?: number
      bold?: boolean
      color?: string
      align?: "left" | "right" | "center"
    } = {},
  ) => {
    doc
      .font(o.bold ? "b" : "r")
      .fontSize(o.size ?? 8)
      .fillColor(o.color ?? INK)
      .text(s, x, y, { width: o.w, align: o.align ?? "left", lineGap: 0.5 })
    return doc.y
  }
  const hline = (y: number, a = X0, b = X1) => doc.moveTo(a, y).lineTo(b, y).stroke()
  const vline = (x: number, a: number, b: number) => doc.moveTo(x, a).lineTo(x, b).stroke()
  doc.lineWidth(0.6).strokeColor(LINE)

  // ── title ───────────────────────────────────────────────────
  text("Tax Invoice", X0, 22, { w: W, size: 12, bold: true, align: "center" })
  text("(ORIGINAL FOR RECIPIENT)", X0, 25, { w: W, size: 7, color: DIM, align: "right" })

  const top = 44

  // ── seller (left) and invoice details (right) ───────────────
  const SPLIT = X0 + 292
  doc.image(LOGO, X0 + 8, top + 8, { height: 30 })
  let y = top + 44
  y = text(seller.name, X0 + 8, y, { size: 10, bold: true })
  for (const line of [
    ...seller.lines,
    `Ph.: ${seller.phones}`,
    `UDYAM: ${seller.udyam}`,
    `GSTIN/UIN: ${seller.gstin}`,
    `State Name: ${seller.state}, Code: ${seller.stateCode}`,
    `Contact: ${seller.contact}`,
    `E-Mail: ${seller.email}`,
  ]) {
    y = text(line, X0 + 8, y + 0.5, { size: 7.5 })
  }
  const sellerBottom = Math.max(y + 8, top + 150)

  const cells: Array<[string, string]> = [
    ["Invoice No.", order.invoiceNumber],
    ["Dated", day(order.invoicedAt)],
    ["Order No.", order.number],
    ["Order Date", day(order.placedAt)],
    [
      "Mode/Terms of Payment",
      order.payment.method === "COD" ? "Cash on delivery" : "Prepaid online",
    ],
    ["Payment Reference", order.payment.reference ?? "-"],
    ["Dispatched through", order.shipment?.courier ?? "-"],
    ["Dispatch Doc No. (AWB)", order.shipment?.awb ?? "-"],
    ["Destination", `${order.address.city} - ${order.address.pincode}`],
    [
      "Place of Supply",
      `${inv.placeOfSupply.state}${inv.placeOfSupply.code ? ` (${inv.placeOfSupply.code})` : ""}`,
    ],
  ]
  const cellW = (X1 - SPLIT) / 2
  const cellH = (sellerBottom - top) / 5
  cells.forEach(([label, value], i) => {
    const cx = SPLIT + (i % 2) * cellW
    const cy = top + Math.floor(i / 2) * cellH
    text(label, cx + 5, cy + 4, { w: cellW - 10, size: 6.8, color: DIM })
    text(value, cx + 5, cy + 13, { w: cellW - 10, size: 8.2, bold: true })
  })
  for (let r = 1; r < 5; r++) hline(top + r * cellH, SPLIT, X1)
  vline(SPLIT + cellW, top, sellerBottom)
  vline(SPLIT, top, sellerBottom)

  // ── buyer ───────────────────────────────────────────────────
  const buyerTop = sellerBottom
  hline(buyerTop)
  const a = order.address
  const name = `${a.firstName} ${a.lastName}`.trim()
  text("Buyer (Bill to) & Consignee (Ship to)", X0 + 8, buyerTop + 5, { size: 7, color: DIM })
  y = text(name.toUpperCase(), X0 + 8, buyerTop + 15, { size: 9, bold: true })
  for (const line of [a.line1, a.line2, `${a.city}, ${a.state} - ${a.pincode}`].filter(Boolean)) {
    y = text(line as string, X0 + 8, y + 0.5, { w: SPLIT - X0 - 16, size: 7.8 })
  }
  let ry = buyerTop + 15
  for (const [label, value] of [
    ["Phone", order.phone],
    ["E-Mail", order.email],
    [
      "State Name",
      `${inv.placeOfSupply.state}${inv.placeOfSupply.code ? `, Code : ${inv.placeOfSupply.code}` : ""}`,
    ],
    ["Place of Supply", inv.placeOfSupply.state],
  ]) {
    text(`${label}`, SPLIT + 8, ry, { w: 70, size: 7.5, color: DIM })
    ry = text(`: ${value}`, SPLIT + 78, ry, { w: X1 - SPLIT - 86, size: 7.8 })
  }
  const tableTop = Math.max(y, ry) + 8
  vline(SPLIT, buyerTop, tableTop)
  hline(tableTop)

  // ── goods ───────────────────────────────────────────────────
  const COLS = [
    { key: "sl", label: "Sl", w: 24, align: "center" as const },
    { key: "desc", label: "Description of Goods", w: 229, align: "left" as const },
    { key: "hsn", label: "HSN/SAC", w: 54, align: "center" as const },
    { key: "qty", label: "Quantity", w: 54, align: "right" as const },
    { key: "rate", label: "Rate", w: 62, align: "right" as const },
    { key: "per", label: "per", w: 30, align: "center" as const },
    { key: "amt", label: "Amount", w: 0, align: "right" as const },
  ]
  COLS[6]!.w = W - COLS.slice(0, 6).reduce((s, c) => s + c.w, 0)
  const colX: number[] = []
  COLS.reduce((x, c) => (colX.push(x), x + c.w), X0)
  const cell = (
    i: number,
    s: string,
    yy: number,
    o: { bold?: boolean; size?: number; color?: string } = {},
  ) => text(s, colX[i]! + 4, yy, { w: COLS[i]!.w - 8, align: COLS[i]!.align, ...o })

  COLS.forEach((c, i) => cell(i, c.label, tableTop + 4, { size: 7, color: DIM }))
  const headBottom = tableTop + 22
  hline(headBottom)

  let rowY = headBottom + 6
  let sl = 0
  for (const row of inv.rows) {
    const goods = row.qty !== null
    if (goods) cell(0, String(++sl), rowY)
    const h = cell(1, row.description, rowY, { bold: goods }) - rowY
    if (row.hsn) cell(2, row.hsn, rowY)
    if (row.qty !== null) cell(3, `${row.qty} Nos`, rowY, { bold: true })
    if (row.rate !== null) cell(4, money(row.rate), rowY)
    if (row.qty !== null) cell(5, "Nos", rowY)
    cell(6, row.amount < 0 ? `(-) ${money(-row.amount)}` : money(row.amount), rowY, { bold: goods })
    rowY += Math.max(h, 11) + 7
  }
  rowY += 6
  for (const tax of inv.taxes) {
    cell(1, `${tax.label} @ ${tax.ratePercent}%`, rowY, { bold: true })
    cell(6, money(tax.amount), rowY, { bold: true })
    rowY += 16
  }

  const bodyBottom = Math.max(rowY + 8, headBottom + 250)
  const totalBottom = bodyBottom + 20
  COLS.slice(1).forEach((_, i) => vline(colX[i + 1]!, tableTop, totalBottom))
  hline(bodyBottom)
  cell(1, "Total", bodyBottom + 6, { bold: true })
  cell(3, `${inv.totalQty} Nos`, bodyBottom + 6, { bold: true })
  cell(6, `₹ ${money(inv.total)}`, bodyBottom + 5, { bold: true, size: 9.5 })
  hline(totalBottom)

  // ── amount in words ─────────────────────────────────────────
  text("Amount Chargeable (in words)", X0 + 6, totalBottom + 5, { size: 7, color: DIM })
  text("E. & O.E", X0, totalBottom + 5, { w: W - 6, size: 7, color: DIM, align: "right" })
  const wordsBottom =
    text(inv.amountInWords, X0 + 6, totalBottom + 15, { w: W - 12, size: 9, bold: true }) + 6
  hline(wordsBottom)

  // ── HSN-wise tax summary ────────────────────────────────────
  const taxCols = inv.interState ? 2 : 4
  const hsnW = W - 90 - taxCols * 58 - 90
  const sx = [X0, X0 + hsnW, X0 + hsnW + 90]
  for (let i = 0; i < taxCols; i++) sx.push(sx[sx.length - 1]! + 58)
  const sumTop = wordsBottom
  const sumHead = sumTop + 26
  text("HSN/SAC", sx[0]! + 4, sumTop + 10, { w: hsnW - 8, size: 7, color: DIM, align: "center" })
  text("Taxable\nValue", sx[1]! + 4, sumTop + 4, { w: 82, size: 7, color: DIM, align: "center" })
  inv.taxes.forEach((t, i) => {
    const x = sx[2 + i * 2]!
    text(t.label, x, sumTop + 3, { w: 116, size: 7, color: DIM, align: "center" })
    text("Rate", x + 2, sumTop + 14, { w: 54, size: 7, color: DIM, align: "center" })
    text("Amount", x + 60, sumTop + 14, { w: 54, size: 7, color: DIM, align: "center" })
    hline(sumTop + 12, x, x + 116)
  })
  text("Total\nTax Amount", sx[sx.length - 1]! + 4, sumTop + 4, {
    w: 82,
    size: 7,
    color: DIM,
    align: "center",
  })
  hline(sumHead)

  const dataY = sumHead + 5
  text(invoiceConfig.hsn, sx[0]! + 6, dataY, { size: 7.8 })
  text(money(inv.taxable), sx[1]! + 4, dataY, { w: 82, size: 7.8, align: "right" })
  inv.taxes.forEach((t, i) => {
    const x = sx[2 + i * 2]!
    text(`${t.ratePercent}%`, x + 2, dataY, { w: 54, size: 7.8, align: "center" })
    text(money(t.amount), x + 60, dataY, { w: 52, size: 7.8, align: "right" })
  })
  text(money(inv.totalTax), sx[sx.length - 1]! + 4, dataY, { w: 82, size: 7.8, align: "right" })
  const sumRow = dataY + 14
  hline(sumRow)
  text("Total", sx[1]! - 40, sumRow + 4, { w: 34, size: 7.8, bold: true, align: "right" })
  text(money(inv.taxable), sx[1]! + 4, sumRow + 4, { w: 82, size: 7.8, bold: true, align: "right" })
  inv.taxes.forEach((t, i) => {
    text(money(t.amount), sx[2 + i * 2]! + 60, sumRow + 4, {
      w: 52,
      size: 7.8,
      bold: true,
      align: "right",
    })
  })
  text(money(inv.totalTax), sx[sx.length - 1]! + 4, sumRow + 4, {
    w: 82,
    size: 7.8,
    bold: true,
    align: "right",
  })
  const sumBottom = sumRow + 18
  // Full-height lines between the columns; the Rate | Amount split inside
  // each tax only below its heading.
  vline(sx[1]!, sumTop, sumBottom)
  inv.taxes.forEach((_, i) => {
    vline(sx[2 + i * 2]!, sumTop, sumBottom)
    vline(sx[3 + i * 2]!, sumTop + 12, sumBottom)
  })
  vline(sx[sx.length - 1]!, sumTop, sumBottom)
  hline(sumBottom)

  // ── tax in words, PAN, declaration, signatory ───────────────
  text("Tax Amount (in words) :", X0 + 6, sumBottom + 6, { size: 7.5, color: DIM })
  text(inv.taxInWords, X0 + 104, sumBottom + 5.5, { w: W - 110, size: 8.5, bold: true })
  text("Company's PAN", X0 + 6, sumBottom + 22, { size: 7.5, color: DIM })
  text(`:  ${seller.pan}`, X0 + 104, sumBottom + 22, { size: 8, bold: true })

  const footTop = sumBottom + 40
  const SIGN = X0 + W * 0.56
  text("Declaration", X0 + 6, footTop, { size: 7.5, bold: true })
  text(
    "We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct. Prices on skelmet.in are inclusive of GST; the tax above is the part of the amount paid that is GST.",
    X0 + 6,
    footTop + 11,
    { w: SIGN - X0 - 16, size: 7.2 },
  )
  doc.rect(SIGN, footTop - 4, X1 - SIGN, 62).stroke()
  text(`for ${seller.name}`, SIGN + 6, footTop + 1, {
    w: X1 - SIGN - 12,
    size: 8,
    bold: true,
    align: "right",
  })
  text("Authorised Signatory", SIGN + 6, footTop + 45, {
    w: X1 - SIGN - 12,
    size: 7.5,
    align: "right",
  })

  const boxBottom = footTop + 62
  doc.rect(X0, top, W, boxBottom - top).stroke()

  text(`SUBJECT TO ${invoiceConfig.jurisdiction.toUpperCase()} JURISDICTION`, X0, boxBottom + 8, {
    w: W,
    size: 7.5,
    align: "center",
  })
  text("This is a Computer Generated Invoice", X0, boxBottom + 19, {
    w: W,
    size: 7,
    color: DIM,
    align: "center",
  })
  text(`${siteConfig.name} · ${siteConfig.url.replace(/^https?:\/\//, "")}`, X0, boxBottom + 30, {
    w: W,
    size: 7,
    color: DIM,
    align: "center",
  })

  doc.end()
  return done
}
