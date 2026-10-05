import "server-only"

import { z } from "zod"

import type { PaymentMethod } from "@/features/checkout/payment-options"
import { moneyModes, whyKeep } from "@/features/orders/server/test-order-rules"
import { paymentConfig } from "@/features/settings/server/runtime-settings"
import { trackingStage } from "@/features/shipping/server/shiprocket-mapping"
import { cancelShiprocketOrder } from "@/features/shipping/server/shipping.service"
import { MAX_PAGE_SIZE, type OrderStatus } from "@/lib/constants"
import { hasDatabase } from "@/lib/env"
import { requireFullAccess } from "@/server/action-guard"
import { fail, ok, runAction, type ActionResult } from "@/server/action-result"
import { createAuditLog } from "@/server/audit"
import { db } from "@/server/db"

/**
 * Deleting orders that were never sales: the ones the shop placed to try
 * itself out, and the unpaid attempts a declined or abandoned payment left.
 *
 * Nothing here can tell a test from a sale on its own, so staff choose the
 * orders - and then everything that marks one as real keeps it, whatever was
 * ticked: money taken through Razorpay's live account, cash collected at the
 * door, a tax invoice number (the series must run without gaps), a parcel
 * still with Shiprocket, or a payment that may yet arrive. What is left goes
 * for good, with its items, payments and shipment; stock it still held goes
 * back on sale and a coupon use it held is given back. Each deletion is in
 * the audit log. Owners and admins only.
 */

/**
 * Orders still holding their stock. Cancelling, expiring and refunding
 * before shipping each gave theirs back already; shipped goods left.
 */
const HOLDS_STOCK: OrderStatus[] = ["PENDING", "CONFIRMED", "PAID", "PACKED"]

const inputSchema = z.object({
  ids: z.array(z.uuid()).min(1).max(MAX_PAGE_SIZE),
  /** Without it, nothing is deleted: the answer says what would be. */
  confirm: z.boolean().optional(),
})

export type TestOrderPlan = {
  /** Deleted, or with `confirm` absent, what would be. */
  deletable: Array<{
    id: string
    number: string
    customer: string
    total: string
    /** Paid through Razorpay's test account. */
    testPayment: boolean
  }>
  kept: Array<{ id: string; number: string; reason: string }>
  deleted: boolean
}

export async function deleteTestOrders(raw: unknown): Promise<ActionResult<TestOrderPlan>> {
  return runAction(async () => {
    const session = await requireFullAccess()
    if (!hasDatabase()) return fail("Database not configured.", undefined, 503)
    const input = inputSchema.parse(raw)

    const [orders, config] = await Promise.all([
      db.order.findMany({
        where: { id: { in: input.ids } },
        select: {
          id: true,
          number: true,
          status: true,
          paymentMethod: true,
          total: true,
          invoiceNumber: true,
          creditNoteNumber: true,
          shiprocketOrderId: true,
          couponId: true,
          shippingAddress: true,
          items: { select: { variantId: true, qty: true } },
          payments: { select: { status: true, mode: true } },
          shipment: { select: { provider: true, status: true } },
        },
      }),
      paymentConfig(),
    ])

    const plan: TestOrderPlan = { deletable: [], kept: [], deleted: false }
    const going: typeof orders = []
    for (const o of orders) {
      const modes = moneyModes(o.payments, config)
      const reason = whyKeep({
        status: o.status as OrderStatus,
        paymentMethod: o.paymentMethod as PaymentMethod,
        invoiceNumber: o.invoiceNumber,
        creditNoteNumber: o.creditNoteNumber,
        moneyModes: modes,
        shipment: o.shipment
          ? { provider: o.shipment.provider, stage: trackingStage(o.shipment.status) }
          : null,
      })
      if (reason) {
        plan.kept.push({ id: o.id, number: o.number, reason })
        continue
      }
      const address = (o.shippingAddress ?? {}) as { firstName?: string; lastName?: string }
      plan.deletable.push({
        id: o.id,
        number: o.number,
        customer: [address.firstName, address.lastName].filter(Boolean).join(" ") || "Guest",
        total: o.total.toString(),
        testPayment: modes.length > 0 && modes.every((m) => m === "test"),
      })
      going.push(o)
    }

    if (!input.confirm) return ok(plan)

    for (const o of going) {
      // Off Shiprocket first, while the order still says which one it was.
      if (o.shiprocketOrderId) await cancelShiprocketOrder(o.id, session)

      const gone = await db.$transaction(async (tx) => {
        // On the status read above: an order that moved since is left alone.
        const removed = await tx.order.deleteMany({ where: { id: o.id, status: o.status } })
        if (removed.count === 0) return false
        if (HOLDS_STOCK.includes(o.status as OrderStatus)) {
          for (const item of o.items) {
            await tx.variant.update({
              where: { id: item.variantId },
              data: { stock: { increment: item.qty } },
            })
          }
        }
        // Cancelling and expiring hand the coupon use back; nothing else does.
        if (o.couponId && o.status !== "CANCELLED") {
          await tx.coupon.updateMany({
            where: { id: o.couponId, usedCount: { gt: 0 } },
            data: { usedCount: { decrement: 1 } },
          })
        }
        return true
      })

      if (!gone) {
        const at = plan.deletable.findIndex((d) => d.id === o.id)
        plan.deletable.splice(at, 1)
        plan.kept.push({
          id: o.id,
          number: o.number,
          reason: "It changed just now. Reload and try again.",
        })
        continue
      }
      await createAuditLog(session, {
        action: "order:delete",
        module: "order",
        entityId: o.id,
        meta: {
          number: o.number,
          status: o.status,
          paymentMethod: o.paymentMethod,
          total: o.total.toString(),
        },
      })
    }
    plan.deleted = true
    return ok(plan)
  })
}
