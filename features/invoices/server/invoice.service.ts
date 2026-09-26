import "server-only"

import type { Session } from "next-auth"

import {
  buildInvoice,
  financialYear,
  invoiceNumber,
  type InvoiceOrder,
} from "@/features/invoices/invoice"
import { renderInvoicePdf } from "@/features/invoices/server/invoice-pdf"
import { renderOrderInvoice } from "@/features/orders/emails/order-invoice"
import { PERMISSIONS, type OrderStatus } from "@/lib/constants"
import { matchState } from "@/lib/india"
import { hasDatabase } from "@/lib/env"
import { sendMail, type MailResult } from "@/lib/mailer"
import { createAuditLog, getAuditMeta } from "@/server/audit"
import { fail, ok, runAction, type ActionResult } from "@/server/action-result"
import { requirePermission } from "@/server/action-guard"
import { db } from "@/server/db"
import { later } from "@/server/later"

/**
 * Tax invoices for orders.
 *
 * An order gets its invoice number the first time anyone needs the invoice -
 * staff printing it to go in the box, or the delivery email - and keeps it:
 * the number and date are fixed once issued, so every copy printed or sent
 * later is the same invoice.
 *
 * Numbers run SKM/<fy>/0001 upwards through each April-to-March financial
 * year, without gaps or repeats, claimed from `invoice_counters` inside the
 * transaction that writes them onto the order.
 */

/** Paid for, or cash on delivery on its way: goods that are, or will be, supplied. */
const INVOICEABLE: OrderStatus[] = ["PAID", "PACKED", "SHIPPED", "DELIVERED"]

type Issued = { invoiceNumber: string; invoicedAt: Date }

/**
 * The order's invoice number, issuing one if it has none. Returns null when
 * the order cannot be invoiced (an unpaid online order, a cancelled one).
 * Safe to race: the order row is locked, so two callers get the same number.
 */
async function issueInvoiceNumber(orderId: string): Promise<Issued | null> {
  return db.$transaction(async (tx) => {
    const [row] = await tx.$queryRaw<
      { invoice_number: string | null; invoiced_at: Date | null; status: OrderStatus }[]
    >`SELECT invoice_number, invoiced_at, status FROM orders WHERE id = ${orderId}::uuid FOR UPDATE`
    if (!row) return null
    if (row.invoice_number && row.invoiced_at) {
      return { invoiceNumber: row.invoice_number, invoicedAt: row.invoiced_at }
    }
    if (!INVOICEABLE.includes(row.status)) return null

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

async function renderInvoice(orderId: string): Promise<RenderedInvoice | null> {
  const issued = await issueInvoiceNumber(orderId)
  if (!issued) return null
  const order = await loadInvoiceOrder(orderId, issued)
  if (!order) return null
  return {
    order,
    pdf: await renderInvoicePdf(buildInvoice(order)),
    filename: `invoice-${issued.invoiceNumber.replaceAll("/", "-")}.pdf`,
  }
}

const NOT_INVOICEABLE =
  "This order cannot be invoiced yet: it needs to be paid for, or be cash on delivery that has been packed."

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
    if (!invoice) return fail(NOT_INVOICEABLE, undefined, 409)

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
    if (!invoice) return fail(NOT_INVOICEABLE, undefined, 409)

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
 * The delivery email, with the invoice attached, after the response. Sent at
 * most once: the order is claimed by setting `invoiceEmailedAt`, and handed
 * back if the mail did not go, so staff can send it from the order page.
 * Never fails the caller.
 */
export function queueInvoiceEmail(orderId: string, session: Session | null = null): void {
  later(async () => {
    const claimed = await db.order.updateMany({
      where: { id: orderId, invoiceEmailedAt: null },
      data: { invoiceEmailedAt: new Date() },
    })
    if (claimed.count === 0) return

    let sent: MailResult | null = null
    try {
      const invoice = await renderInvoice(orderId)
      if (invoice) {
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
        }
      }
    } catch (err) {
      console.error("[INVOICE] delivery email not sent", orderId, err)
    }

    if (!sent?.delivered) {
      await db.order.updateMany({ where: { id: orderId }, data: { invoiceEmailedAt: null } })
    }
  })
}
