import "server-only"

import { couponReduction, priceCart } from "@/features/cart/server/cart-pricing"
import {
  placeOrderSchema,
  verifyPaymentSchema,
} from "@/features/checkout/schemas/checkout.schema"
import {
  createGatewayOrder,
  isGatewayConfigured,
  publicKeyId,
  verifyPaymentSignature,
} from "@/features/checkout/server/payment-gateway"
import { orderNumber } from "@/lib/crypto"
import { hasDatabase } from "@/lib/env"
import { createAuditLog, getAuditMeta } from "@/server/audit"
import { fail, ok, runAction, type ActionResult } from "@/server/action-result"
import { optionalSession } from "@/server/action-guard"
import { db } from "@/server/db"

export type StartedCheckout = {
  orderId: string
  orderNumber: string
  total: string
  /** Null for COD — nothing to hand the gateway. */
  gatewayOrderId: string | null
  gatewayKeyId: string | null
  paymentMethod: "ONLINE" | "COD"
}

/**
 * Places the order and, for online payment, opens a Razorpay order.
 *
 * The client sends SKUs and quantities only. Prices, the bundle discount and
 * any coupon are recomputed here from the database, so a tampered cart cannot
 * change what is charged.
 */
export async function placeOrder(raw: unknown): Promise<ActionResult<StartedCheckout>> {
  return runAction(async () => {
    const input = placeOrderSchema.parse(raw)
    if (!hasDatabase()) return fail("Checkout is not available yet.", undefined, 503)

    const session = await optionalSession()

    const variants = await db.variant.findMany({
      where: { sku: { in: input.items.map((i) => i.sku) } },
      select: {
        id: true,
        sku: true,
        price: true,
        stock: true,
        colourway: true,
        product: { select: { name: true } },
      },
    })

    if (variants.length !== input.items.length) {
      return fail("One of those items is no longer available.", undefined, 409)
    }

    const lines = input.items.map((item) => {
      const variant = variants.find((v) => v.sku === item.sku)!
      return { variant, qty: item.qty, unitPrice: variant.price.toString() }
    })

    const short = lines.find((l) => l.variant.stock < l.qty)
    if (short) {
      return fail(
        `Only ${short.variant.stock} left of ${short.variant.product.name} in ${short.variant.colourway}.`,
        undefined,
        409,
      )
    }

    // ── pricing, server-side ────────────────────────────────
    const base = priceCart(lines)
    let couponId: string | null = null
    let couponOff = 0

    if (input.couponCode) {
      const coupon = await db.coupon.findUnique({
        where: { code: input.couponCode.toUpperCase() },
        select: {
          id: true,
          kind: true,
          value: true,
          minSubtotal: true,
          maxUses: true,
          usedCount: true,
          expiresAt: true,
        },
      })

      if (!coupon) return fail("That code is not valid.", undefined, 422)
      if (coupon.expiresAt && coupon.expiresAt.getTime() < Date.now()) {
        return fail("That code has expired.", undefined, 422)
      }
      if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
        return fail("That code has been fully used.", undefined, 422)
      }

      couponOff = couponReduction(coupon, base.subtotal)
      if (couponOff <= 0) {
        return fail(
          `That code needs a subtotal of at least ₹${Number(coupon.minSubtotal)}.`,
          undefined,
          422,
        )
      }
      couponId = coupon.id
    }

    // Before the transaction, not after: failing here once the order exists
    // leaves an orphan holding stock nobody can buy.
    if (input.paymentMethod === "ONLINE" && !isGatewayConfigured()) {
      return fail("Online payment is not configured yet. Try cash on delivery.", undefined, 503)
    }

    const priced = priceCart(lines, { cod: input.paymentMethod === "COD", couponOff })
    const number = orderNumber(new Date())

    // ── write the order and claim stock in one transaction ──
    const order = await db.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          number,
          paymentMethod: input.paymentMethod,
          userId: session?.user?.id ?? null,
          status: "PENDING",
          email: input.email.toLowerCase(),
          phone: input.phone,
          shippingAddress: { ...input.address, giftNote: input.giftNote },
          subtotal: priced.subtotal,
          discount: priced.discount,
          shipping: priced.shipping,
          tax: 0,
          total: priced.total,
          couponId,
          items: {
            create: lines.map((l) => ({
              variantId: l.variant.id,
              qty: l.qty,
              unitPrice: l.unitPrice,
              nameSnapshot: `${l.variant.product.name} · ${l.variant.colourway}`,
            })),
          },
        },
        select: { id: true, number: true, total: true },
      })

      // Atomic claim per line — a concurrent order cannot oversell (§5).
      for (const line of lines) {
        const claimed = await tx.variant.updateMany({
          where: { id: line.variant.id, stock: { gte: line.qty } },
          data: { stock: { decrement: line.qty } },
        })
        if (claimed.count === 0) {
          throw new Error(`OUT_OF_STOCK:${line.variant.sku}`)
        }
      }

      if (couponId) {
        await tx.coupon.update({
          where: { id: couponId },
          data: { usedCount: { increment: 1 } },
        })
      }

      return created
    })

    // ── open the gateway order ─────────────────────────────
    let gatewayOrderId: string | null = null
    if (input.paymentMethod === "ONLINE") {
      const gw = await createGatewayOrder({
        amountRupees: priced.total,
        receipt: order.number,
        notes: { orderId: order.id, orderNumber: order.number },
      })
      gatewayOrderId = gw.id

      await db.payment.create({
        data: {
          orderId: order.id,
          gateway: "razorpay",
          gatewayOrderId: gw.id,
          status: "CREATED",
          amount: priced.total,
        },
      })
    }

    await createAuditLog(session, {
      action: "order:place",
      module: "order",
      entityId: order.id,
      meta: { number: order.number, total: priced.total, method: input.paymentMethod },
      ...(await getAuditMeta()),
    })

    return ok({
      orderId: order.id,
      orderNumber: order.number,
      total: order.total.toString(),
      gatewayOrderId,
      gatewayKeyId: gatewayOrderId ? publicKeyId() : null,
      paymentMethod: input.paymentMethod,
    })
  })
}

/**
 * Called by the browser after Razorpay's handler fires. The webhook is the
 * source of truth; this exists so the customer sees confirmation immediately
 * instead of waiting on a server-to-server round trip.
 */
export async function confirmPayment(
  raw: unknown,
): Promise<ActionResult<{ orderNumber: string; status: string }>> {
  return runAction(async () => {
    const input = verifyPaymentSchema.parse(raw)
    if (!hasDatabase()) return fail("Checkout is not available yet.", undefined, 503)

    if (!verifyPaymentSignature(input)) {
      await createAuditLog(null, {
        action: "payment:signature-invalid",
        module: "order",
        entityId: input.orderId,
        meta: { gatewayOrderId: input.gatewayOrderId },
      })
      return fail("We could not verify that payment.", undefined, 422)
    }

    // Atomic claim — the webhook may have got here first, and marking an order
    // PAID twice must not double-fire anything downstream (§5).
    const claimed = await db.order.updateMany({
      where: { id: input.orderId, status: "PENDING" },
      data: { status: "PAID", placedAt: new Date() },
    })

    await db.payment.updateMany({
      where: { orderId: input.orderId, gatewayOrderId: input.gatewayOrderId },
      data: { gatewayPaymentId: input.gatewayPaymentId, status: "CAPTURED" },
    })

    const order = await db.order.findUnique({
      where: { id: input.orderId },
      select: { number: true, status: true },
    })
    if (!order) return fail("Order not found.", undefined, 404)

    if (claimed.count > 0) {
      await createAuditLog(null, {
        action: "order:paid",
        module: "order",
        entityId: input.orderId,
        meta: { gatewayPaymentId: input.gatewayPaymentId },
      })
    }

    return ok({ orderNumber: order.number, status: order.status })
  })
}

/** Razorpay webhook. Already signature-verified at the route. */
export async function applyPaymentWebhook(event: {
  event: string
  payload: { payment?: { entity?: { id?: string; order_id?: string; status?: string } } }
}): Promise<ActionResult<{ handled: boolean }>> {
  return runAction<{ handled: boolean }>(async () => {
    if (!hasDatabase()) return ok({ handled: false })

    const entity = event.payload?.payment?.entity
    const gatewayOrderId = entity?.order_id
    const gatewayPaymentId = entity?.id
    if (!gatewayOrderId) return ok({ handled: false })

    const payment = await db.payment.findFirst({
      where: { gatewayOrderId },
      select: { id: true, orderId: true },
    })
    if (!payment) return ok({ handled: false })

    if (event.event === "payment.captured") {
      await db.order.updateMany({
        where: { id: payment.orderId, status: "PENDING" },
        data: { status: "PAID", placedAt: new Date() },
      })
      await db.payment.update({
        where: { id: payment.id },
        data: { status: "CAPTURED", gatewayPaymentId: gatewayPaymentId ?? null },
      })
      await createAuditLog(null, {
        action: "order:paid-webhook",
        module: "order",
        entityId: payment.orderId,
        meta: { gatewayPaymentId },
      })
      return ok({ handled: true })
    }

    if (event.event === "payment.failed") {
      await db.payment.update({
        where: { id: payment.id },
        data: { status: "FAILED", gatewayPaymentId: gatewayPaymentId ?? null },
      })
      await createAuditLog(null, {
        action: "payment:failed",
        module: "order",
        entityId: payment.orderId,
      })
      return ok({ handled: true })
    }

    return ok({ handled: false })
  })
}
