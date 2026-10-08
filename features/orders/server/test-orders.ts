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

// Deletes test and never-paid orders that staff tick. Never deleted, whatever is
// ticked (whyKeep): live Razorpay money, cash collected, an invoice number (the
// series must have no gaps), a parcel with Shiprocket, a payment that may arrive.
// Owners and admins only; every deletion is audited.

/** Cancelling, expiring and refunding before shipping already gave stock back. */
const HOLDS_STOCK: OrderStatus[] = ["PENDING", "CONFIRMED", "PAID", "PACKED"]

const inputSchema = z.object({
  ids: z.array(z.uuid()).min(1).max(MAX_PAGE_SIZE),
  /** Without it, a preview: nothing is deleted. */
  confirm: z.boolean().optional(),
})

export type TestOrderPlan = {
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
      // Before the delete, while the order still names its Shiprocket order.
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
