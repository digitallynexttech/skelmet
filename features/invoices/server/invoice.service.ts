import "server-only"

import type { Session } from "next-auth"

import { modeOfPayment } from "@/features/checkout/server/payment-gateway"
import {
  buildInvoice,
  creditNoteCounterKey,
  creditNoteNumber,
  financialYear,
  invoiceNumber,
  type InvoiceOrder,
} from "@/features/invoices/invoice"
import { renderInvoicePdf } from "@/features/invoices/server/invoice-pdf"
import { renderOrderInvoice } from "@/features/orders/emails/order-invoice"
import { paymentConfig } from "@/features/settings/server/runtime-settings"
import { PERMISSIONS, type OrderStatus } from "@/lib/constants"
import { matchState } from "@/lib/india"
import { hasDatabase } from "@/lib/env"
import { sendMail, type MailResult } from "@/lib/mailer"
import { createAuditLog, getAuditMeta } from "@/server/audit"
import { fail, ok, runAction, type ActionResult } from "@/server/action-result"
import { requirePermission } from "@/server/action-guard"
import { db } from "@/server/db"
import { later } from "@/server/later"

// An invoice number and date are issued on first need and never change. Numbers run
// SKM/<fy>/0001 (credit notes CN/<fy>/0001) per April-March year, gapless, from
// `invoice_counters` in the same transaction. A refunded or cancelled order gets a
// credit note, never its invoice again; test-mode orders get neither.

/** Paid for, or cash on delivery on its way: goods that are, or will be, supplied. */
const INVOICEABLE: OrderStatus[] = ["PAID", "PACKED", "SHIPPED", "DELIVERED"]

/** The sale was undone: a credit note, never a tax invoice. */
const CREDITED: OrderStatus[] = ["REFUNDED", "CANCELLED"]

type Issued = { invoiceNumber: string; invoicedAt: Date }

/** Why an order gets no tax invoice. */
type Refusal = "missing" | "not-invoiceable" | "credited" | "test-mode"

const NOT_INVOICEABLE =
  "This order cannot be invoiced yet: it needs to be paid for, or be cash on delivery that has been packed."

export const TEST_MODE_REFUSAL = "Test-mode orders don't get tax invoices."

const REFUSED: Record<Refusal, { message: string; status: number }> = {
  missing: { message: "Order not found.", status: 404 },
  "not-invoiceable": { message: NOT_INVOICEABLE, status: 409 },
  credited: {
    message:
      "This order was refunded or cancelled, so it has no tax invoice to give. Print its credit note instead.",
    status: 409,
  },
  "test-mode": { message: TEST_MODE_REFUSAL, status: 409 },
}

const refused = (why: Refusal) => fail(REFUSED[why].message, undefined, REFUSED[why].status)

/** Whether the order was paid on Razorpay's test account (not a sale: no numbers used). */
async function paidInTestMode(orderId: string): Promise<boolean> {
  const payment = await db.payment.findFirst({
    where: { orderId, gateway: "razorpay", status: { in: ["CAPTURED", "REFUNDED"] } },
    select: { mode: true },
    orderBy: { createdAt: "desc" },
  })
  if (!payment) return false
  return modeOfPayment(payment.mode, await paymentConfig()) === "test"
}

/** The order's invoice number, issued if missing, or why it cannot have one. Row-locked, so race-safe. */
async function issueInvoiceNumber(orderId: string): Promise<Issued | Refusal> {
  return db.$transaction(async (tx) => {
    const [row] = await tx.$queryRaw<
      { invoice_number: string | null; invoiced_at: Date | null; status: OrderStatus }[]
    >`SELECT invoice_number, invoiced_at, status FROM orders WHERE id = ${orderId}::uuid FOR UPDATE`
    if (!row) return "missing"
    // Before returning an existing number: a refunded order must not reprint its invoice.
    if (CREDITED.includes(row.status)) return "credited"
    if (row.invoice_number && row.invoiced_at) {
      return { invoiceNumber: row.invoice_number, invoicedAt: row.invoiced_at }
    }
    if (!INVOICEABLE.includes(row.status)) return "not-invoiceable"

    const invoicedAt = new Date()
    const fy = financialYear(invoicedAt)
    // One statement, so two orders invoiced at once cannot read the same last.
    const [counter] = await tx.$queryRaw<{ last: number }[]>`
      INSERT INTO invoice_counters (fy, last) VALUES (${fy}, 1)
      ON CONFLICT (fy) DO UPDATE SET last = invoice_counters.last + 1
      RETURNING last`
    const number = invoiceNumber(fy, counter!.last)

    await tx.order.update({ where: { id: orderId }, data: { invoiceNumber: number, invoicedAt } })
    return { invoiceNumber: number, invoicedAt }
  })
}

type CreditIssued = Issued & { creditNoteNumber: string; creditedAt: Date; fresh: boolean }

/** The credit note number for an invoiced, then refunded or cancelled, order. Row-locked. */
async function issueCreditNote(
  orderId: string,
): Promise<CreditIssued | "missing" | "no-invoice" | "not-credited"> {
  return db.$transaction(async (tx) => {
    const [row] = await tx.$queryRaw<
      {
        invoice_number: string | null
        invoiced_at: Date | null
        credit_note_number: string | null
        credited_at: Date | null
        status: OrderStatus
      }[]
    >`SELECT invoice_number, invoiced_at, credit_note_number, credited_at, status FROM orders WHERE id = ${orderId}::uuid FOR UPDATE`
    if (!row) return "missing"
    if (!row.invoice_number || !row.invoiced_at) return "no-invoice"
    const invoice = { invoiceNumber: row.invoice_number, invoicedAt: row.invoiced_at }
    if (row.credit_note_number && row.credited_at) {
      return {
        ...invoice,
        creditNoteNumber: row.credit_note_number,
        creditedAt: row.credited_at,
        fresh: false,
      }
    }
    if (!CREDITED.includes(row.status)) return "not-credited"

    const creditedAt = new Date()
    const fy = financialYear(creditedAt)
    const key = creditNoteCounterKey(fy)
    const [counter] = await tx.$queryRaw<{ last: number }[]>`
      INSERT INTO invoice_counters (fy, last) VALUES (${key}, 1)
      ON CONFLICT (fy) DO UPDATE SET last = invoice_counters.last + 1
      RETURNING last`
    const number = creditNoteNumber(fy, counter!.last)

    await tx.order.update({
      where: { id: orderId },
      data: { creditNoteNumber: number, creditedAt },
    })
    return { ...invoice, creditNoteNumber: number, creditedAt, fresh: true }
  })
}

type Address = {
  firstName?: string
  lastName?: string
  line1?: string
  line2?: string
  city?: string
  state?: string
  pincode?: string
}

/** "new delhi" typed all in lower case prints as "New Delhi"; anything else as typed. */
function tidyCase(value: string): string {
  return value === value.toLowerCase()
    ? value.replace(/(^|[\s(-])(\p{L})/gu, (_, gap: string, c: string) => gap + c.toUpperCase())
    : value
}

/** Everything the invoice prints, read from the order as it was placed. */
async function loadInvoiceOrder(orderId: string, issued: Issued): Promise<InvoiceOrder | null> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      number: true,
      email: true,
      phone: true,
      paymentMethod: true,
      shippingAddress: true,
      discount: true,
      shipping: true,
      paymentFee: true,
      total: true,
      createdAt: true,
      placedAt: true,
      coupon: { select: { code: true } },
      items: {
        select: {
          nameSnapshot: true,
          qty: true,
          unitPrice: true,
          variant: { select: { sku: true } },
        },
      },
      payments: {
        where: { status: { in: ["CAPTURED", "REFUNDED"] } },
        select: { gatewayPaymentId: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      shipment: { select: { courier: true, awb: true } },
    },
  })
  if (!order) return null
  const a = (order.shippingAddress ?? {}) as Address

  return {
    number: order.number,
    placedAt: order.placedAt ?? order.createdAt,
    invoiceNumber: issued.invoiceNumber,
    invoicedAt: issued.invoicedAt,
    email: order.email,
    phone: order.phone,
    address: {
      firstName: a.firstName ?? "",
      lastName: a.lastName ?? "",
      line1: a.line1 ?? "",
      ...(a.line2 ? { line2: a.line2 } : {}),
      city: tidyCase(a.city ?? ""),
      state: matchState(a.state ?? "") ?? a.state ?? "",
      pincode: a.pincode ?? "",
    },
    items: order.items.map((i) => ({
      name: i.nameSnapshot,
      sku: i.variant.sku,
      qty: i.qty,
      unitPrice: Number(i.unitPrice),
    })),
    discount: Number(order.discount),
    shipping: Number(order.shipping),
    paymentFee: Number(order.paymentFee),
    total: Number(order.total),
    couponCode: order.coupon?.code ?? null,
    payment: {
      method: order.paymentMethod,
      reference: order.payments[0]?.gatewayPaymentId ?? null,
    },
    shipment: order.shipment ? { courier: order.shipment.courier, awb: order.shipment.awb } : null,
  }
}

type RenderedInvoice = {
  order: InvoiceOrder
  pdf: Buffer
  filename: string
}

async function renderInvoice(orderId: string): Promise<RenderedInvoice | Refusal> {
  if (await paidInTestMode(orderId)) return "test-mode"
  const issued = await issueInvoiceNumber(orderId)
  if (typeof issued === "string") return issued
  const order = await loadInvoiceOrder(orderId, issued)
  if (!order) return "missing"
  return {
    order,
    pdf: await renderInvoicePdf(buildInvoice(order)),
    filename: `invoice-${issued.invoiceNumber.replaceAll("/", "-")}.pdf`,
  }
}

/** The invoice PDF, for staff to print and put in the box. */
export async function getInvoicePdf(
  id: string,
): Promise<ActionResult<{ pdf: Buffer; filename: string }>> {
  return runAction(async () => {
    const session = await requirePermission(PERMISSIONS.ORDER_READ)
    if (!hasDatabase()) return fail("Database not configured.", undefined, 503)

    const existing = await db.order.findUnique({
      where: { id },
      select: { invoiceNumber: true },
    })
    if (!existing) return fail("Order not found.", undefined, 404)
    // Reading an issued invoice is a read; issuing a number is fulfilment.
    if (!existing.invoiceNumber) await requirePermission(PERMISSIONS.ORDER_FULFIL)

    const invoice = await renderInvoice(id)
    if (typeof invoice === "string") return refused(invoice)

    if (!existing.invoiceNumber) {
      await createAuditLog(session, {
        action: "order:invoice",
        module: "order",
        entityId: id,
        meta: { invoiceNumber: invoice.order.invoiceNumber },
        ...(await getAuditMeta()),
      })
    }
    return ok({ pdf: invoice.pdf, filename: invoice.filename })
  })
}

async function mailInvoice(invoice: RenderedInvoice): Promise<MailResult> {
  const { order } = invoice
  return sendMail({
    to: order.email,
    ...renderOrderInvoice({
      number: order.number,
      invoiceNumber: order.invoiceNumber,
      firstName: order.address.firstName,
      total: new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2 }).format(order.total),
    }),
    attachments: [
      { filename: invoice.filename, content: invoice.pdf, contentType: "application/pdf" },
    ],
  })
}

/** Staff sending the invoice (again) from the order page. */
export async function emailInvoice(
  id: string,
): Promise<ActionResult<{ invoiceNumber: string; emailedAt: string; to: string }>> {
  return runAction(async () => {
    const session = await requirePermission(PERMISSIONS.ORDER_FULFIL)
    if (!hasDatabase()) return fail("Database not configured.", undefined, 503)

    const invoice = await renderInvoice(id)
    if (typeof invoice === "string") return refused(invoice)

    const sent = await mailInvoice(invoice)
    if (!sent.delivered) {
      return sent.ok
        ? fail("Email is not set up on this server (SMTP), so nothing was sent.", undefined, 503)
        : fail("The mail server did not accept the email. Try again in a minute.", undefined, 502)
    }

    const emailedAt = new Date()
    await db.order.update({ where: { id }, data: { invoiceEmailedAt: emailedAt } })
    await createAuditLog(session, {
      action: "order:invoice-email",
      module: "order",
      entityId: id,
      meta: { invoiceNumber: invoice.order.invoiceNumber, to: invoice.order.email },
      ...(await getAuditMeta()),
    })
    return ok({
      invoiceNumber: invoice.order.invoiceNumber,
      emailedAt: emailedAt.toISOString(),
      to: invoice.order.email,
    })
  })
}

/**
 * The delivery email with the invoice, after the response. Sent at most once: claimed
 * via `invoiceEmailedAt`, handed back if the mail did not go. Never fails the caller.
 * Keep the claim inside the try: in after() a rejection goes unseen. Failures are audit-logged.
 */
export function queueInvoiceEmail(orderId: string, session: Session | null = null): void {
  later(async () => {
    let claimed = false
    let sent: MailResult | null = null
    let failure: string | null = null

    try {
      const claim = await db.order.updateMany({
        where: { id: orderId, invoiceEmailedAt: null },
        data: { invoiceEmailedAt: new Date() },
      })
      if (claim.count === 0) return
      claimed = true

      const invoice = await renderInvoice(orderId)
      // A refusal (test mode, refunded) is not a failure: there is nothing to send.
      if (typeof invoice !== "string") {
        sent = await mailInvoice(invoice)
        if (sent.delivered) {
          await createAuditLog(session, {
            action: "order:invoice-email",
            module: "order",
            entityId: orderId,
            meta: {
              invoiceNumber: invoice.order.invoiceNumber,
              to: invoice.order.email,
              auto: true,
            },
          })
        } else {
          failure = sent.ok ? "SMTP is not configured" : sent.error
        }
      }
    } catch (err) {
      console.error("[INVOICE] delivery email not sent", orderId, err)
      failure = err instanceof Error ? err.message : String(err)
    }

    if (claimed && !sent?.delivered) {
      try {
        await db.order.updateMany({ where: { id: orderId }, data: { invoiceEmailedAt: null } })
      } catch (err) {
        console.error("[INVOICE] could not hand back the email claim", orderId, err)
      }
    }
    if (failure) {
      await createAuditLog(session, {
        action: "order:invoice-email-failed",
        module: "order",
        entityId: orderId,
        meta: { error: failure.slice(0, 300), auto: true },
      })
    }
  })
}

// ── credit notes ─────────────────────────────────────────────

const NO_CREDIT: Record<"missing" | "no-invoice" | "not-credited", [string, number]> = {
  missing: ["Order not found.", 404],
  "no-invoice": ["This order never had a tax invoice, so there is nothing to credit.", 409],
  "not-credited": ["Only a refunded or cancelled order gets a credit note.", 409],
}

/** The credit note PDF for a refunded order that had been invoiced. */
export async function getCreditNotePdf(
  id: string,
): Promise<ActionResult<{ pdf: Buffer; filename: string }>> {
  return runAction(async () => {
    const session = await requirePermission(PERMISSIONS.ORDER_READ)
    if (!hasDatabase()) return fail("Database not configured.", undefined, 503)

    const existing = await db.order.findUnique({
      where: { id },
      select: { creditNoteNumber: true },
    })
    if (!existing) return fail("Order not found.", undefined, 404)
    // Reading an issued credit note is a read; issuing one belongs to refunds.
    if (!existing.creditNoteNumber) await requirePermission(PERMISSIONS.ORDER_REFUND)
    if (await paidInTestMode(id)) return refused("test-mode")

    const credit = await issueCreditNote(id)
    if (typeof credit === "string") {
      const [message, status] = NO_CREDIT[credit]
      return fail(message, undefined, status)
    }

    const order = await loadInvoiceOrder(id, credit)
    if (!order) return fail("Order not found.", undefined, 404)
    const pdf = await renderInvoicePdf(buildInvoice(order), {
      kind: "credit-note",
      number: credit.creditNoteNumber,
      date: credit.creditedAt,
    })

    if (credit.fresh) {
      await createAuditLog(session, {
        action: "order:credit-note",
        module: "order",
        entityId: id,
        meta: { creditNoteNumber: credit.creditNoteNumber, invoiceNumber: credit.invoiceNumber },
        ...(await getAuditMeta()),
      })
    }
    return ok({ pdf, filename: `credit-note-${credit.creditNoteNumber.replaceAll("/", "-")}.pdf` })
  })
}

/** Issues the credit note after a refund. Best effort: first print issues it otherwise. */
export async function creditNoteOnRefund(orderId: string, session: Session | null): Promise<void> {
  try {
    if (await paidInTestMode(orderId)) return
    const credit = await issueCreditNote(orderId)
    if (typeof credit === "string" || !credit.fresh) return
    await createAuditLog(session, {
      action: "order:credit-note",
      module: "order",
      entityId: orderId,
      meta: { creditNoteNumber: credit.creditNoteNumber, invoiceNumber: credit.invoiceNumber },
    })
  } catch (err) {
    console.error("[INVOICE] could not issue the credit note", orderId, err)
  }
}
