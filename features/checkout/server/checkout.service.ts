import "server-only"

import { couponReduction, priceCart } from "@/features/cart/server/cart-pricing"
import { placeOrderSchema, verifyPaymentSchema } from "@/features/checkout/schemas/checkout.schema"
import {
  createGatewayOrder,
  isGatewayConfigured,
  publicKeyId,
  verifyPaymentSignature,
} from "@/features/checkout/server/payment-gateway"
import { attachCustomer } from "@/features/customers/server/customers.service"
import { rememberOrder, rememberedOrder } from "@/features/checkout/server/recent-order"
import { renderOrderConfirmed } from "@/features/orders/emails/order-confirmed"
import { sendMail } from "@/lib/mailer"
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
 * True only for a unique-constraint violation on the order number.
 *
 * Checked structurally rather than with `instanceof`, so it does not depend on
 * which Prisma entrypoint happened to construct the error, and narrowed to the
 * `number` target so a different unique index never silently retries.
 */
function isDuplicateNumber(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  if ((err as { code?: unknown }).code !== "P2002") return false
  const target = (err as { meta?: { target?: unknown } }).meta?.target
  const fields = Array.isArray(target) ? target.map(String) : [String(target ?? "")]
  return fields.some((x) => x.includes("number"))
}

/**
 * Gives back everything a committed order took, when its payment could never
 * be started.
 *
 * The status claim goes first and is conditional on PENDING, so two concurrent
 * releases cannot both restock the same lines — whoever flips it wins and the
 * loser returns having done nothing. All of it rides one transaction because a
 * half-undo is worse than none: stock back while the order is still PENDING
 * would let it be paid for goods that have already been re-sold.
 */
async function releaseOrder(input: {
  orderId: string
  lines: { variant: { id: string }; qty: number }[]
  couponId: string | null
}): Promise<void> {
  try {
    await db.$transaction(async (tx) => {
      const claimed = await tx.order.updateMany({
        where: { id: input.orderId, status: "PENDING" },
        data: { status: "CANCELLED" },
      })
      if (claimed.count === 0) return

      for (const line of input.lines) {
        await tx.variant.update({
          where: { id: line.variant.id },
          data: { stock: { increment: line.qty } },
        })
      }

      if (input.couponId) {
        await tx.coupon.updateMany({
          where: { id: input.couponId, usedCount: { gt: 0 } },
          data: { usedCount: { decrement: 1 } },
        })
      }
    })
  } catch (err) {
    // A cleanup that fails must not replace the gateway error the customer is
    // waiting on. The order stays PENDING and an admin can cancel it, which
    // restocks down this same path.
    console.error("[CHECKOUT] release failed for", input.orderId, err)
  }
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
      return fail(
        "Payments are temporarily unavailable. Please try again shortly.",
        undefined,
        503,
      )
    }

    // cod stays in priceCart for the orders already placed with it and for
    // the day it comes back; nothing reaching here can select it now.
    const priced = priceCart(lines, { cod: false, couponOff })

    // ── write the order and claim stock in one transaction ──
    const writeOrder = (number: string) =>
      db.$transaction(async (tx) => {
        // Record who bought, before the order row, so it can point at them.
        // A guest checkout still produces a customer: there is no signup here,
        // so this is the only moment the shop ever learns who someone is.
        const customerId = await attachCustomer(tx, {
          email: input.email,
          phone: input.phone,
          address: input.address,
        })

        const created = await tx.order.create({
          data: {
            number,
            paymentMethod: input.paymentMethod,
            // A signed-in staff id wins when there is one, so an admin placing an
            // order on someone's behalf still owns it. Otherwise the order points
            // at the customer record checkout just wrote.
            userId: session?.user?.id ?? customerId,
            status: "PENDING",
            email: input.email.toLowerCase(),
            phone: input.phone,
            shippingAddress: { ...input.address },
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

    // SKM-YYYY-XXXX draws 4 characters from a 32-letter alphabet, so a year's
    // numbers collide with each other at about a one-in-a-million chance per
    // pair — rare, and `number` is @unique, so the loser used to get a raw
    // P2002 rendered as "Something went wrong" after their card was already
    // charged. A fresh number costs nothing; only a genuine duplicate retries,
    // and an out-of-stock throw still aborts on the first attempt.
    let order: Awaited<ReturnType<typeof writeOrder>> | null = null
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        order = await writeOrder(orderNumber(new Date()))
        break
      } catch (err) {
        if (!isDuplicateNumber(err) || attempt === 5) throw err
      }
    }
    if (!order) return fail("Could not place the order just now. Try again.", undefined, 503)

    // ── open the gateway order ─────────────────────────────
    //
    // The transaction above has already committed, so a failure here cannot be
    // rolled back — it has to be compensated. The isGatewayConfigured() check
    // further up only proves the keys are PRESENT; Razorpay can still refuse
    // the call itself, and does: rejected credentials answer 401, and an
    // outage or a dropped connection never answers at all. Every one of those
    // used to leave exactly the orphan that check was written to prevent — a
    // PENDING order nobody can pay, sitting on claimed stock and on a coupon
    // redemption nobody used.
    let gatewayOrderId: string | null = null
    if (input.paymentMethod === "ONLINE") {
      try {
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
      } catch (err) {
        console.error("[CHECKOUT] gateway refused, releasing", order.number, err)
        await releaseOrder({ orderId: order.id, lines, couponId })
        return fail("Could not start the payment. Try again.", undefined, 502)
      }
    }

    await createAuditLog(session, {
      action: "order:place",
      module: "order",
      entityId: order.id,
      meta: { number: order.number, total: priced.total, method: input.paymentMethod },
      ...(await getAuditMeta()),
    })

    // The one moment we know for certain this browser owns this order.
    await rememberOrder(order.number)

    // No receipt from here any more. With cash on delivery withdrawn, placing
    // an order is no longer a commitment to anything — an order is real when
    // its payment clears, so confirmPayment and the webhook own the email.
    // Sending one here would confirm an abandoned payment page.

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
      select: {
        number: true,
        status: true,
        email: true,
        total: true,
        items: { select: { nameSnapshot: true, qty: true } },
      },
    })
    if (!order) return fail("Order not found.", undefined, 404)

    // Everything in here hangs off the claim, which is what makes it
    // exactly-once: this route and the webhook both try to flip PENDING, only
    // one of them gets a row back, and the loser must not email a second
    // receipt for the same payment.
    if (claimed.count > 0) {
      await createAuditLog(null, {
        action: "order:paid",
        module: "order",
        entityId: input.orderId,
        meta: { gatewayPaymentId: input.gatewayPaymentId },
      })

      const mail = renderOrderConfirmed({
        number: order.number,
        email: order.email,
        total: order.total.toString(),
        paymentMethod: "ONLINE",
        items: order.items.map((i) => ({ name: i.nameSnapshot, qty: i.qty })),
      })
      await sendMail({ to: order.email, ...mail })
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
      const claimed = await db.order.updateMany({
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

      // Only when this delivery is what moved the order. A redelivery, or a
      // browser that already confirmed, claims nothing and sends nothing.
      if (claimed.count > 0) {
        const order = await db.order.findUnique({
          where: { id: payment.orderId },
          select: {
            number: true,
            email: true,
            total: true,
            items: { select: { nameSnapshot: true, qty: true } },
          },
        })
        if (order) {
          const mail = renderOrderConfirmed({
            number: order.number,
            email: order.email,
            total: order.total.toString(),
            paymentMethod: "ONLINE",
            items: order.items.map((i) => ({ name: i.nameSnapshot, qty: i.qty })),
          })
          await sendMail({ to: order.email, ...mail })
        }
      }
      return ok({ handled: true })
    }

    if (event.event === "payment.failed") {
      // Conditional on CREATED, the same way the capture above claims PENDING.
      //
      // A customer whose first card is declined and whose second succeeds
      // generates BOTH events, and Razorpay does not promise the order they
      // arrive in. An unconditional write here let a late failure land on a
      // row that had already been captured — flipping a paid order's payment
      // to FAILED and, worse, overwriting the gatewayPaymentId with the
      // declined attempt's, which is the id a refund would later resolve by.
      const claimed = await db.payment.updateMany({
        where: { id: payment.id, status: "CREATED" },
        data: { status: "FAILED", gatewayPaymentId: gatewayPaymentId ?? null },
      })
      if (claimed.count === 0) {
        console.error("[WEBHOOK] ignored a late payment.failed for", payment.orderId)
        return ok({ handled: false })
      }
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

export type Confirmation = {
  number: string
  email: string
  total: string
  status: string
  paymentMethod: "ONLINE" | "COD"
  placedAt: string | null
  itemCount: number
  items: { name: string; qty: number }[]
}

/**
 * The order behind the confirmation screen.
 *
 * Authorised by the cookie `placeOrder` set, or by owning the order when
 * signed in. A wrong number, someone else's number and a number that never
 * existed all answer the same 404 — anything else turns this into an oracle
 * for which order numbers are real.
 */
export async function getConfirmation(rawNumber: string): Promise<ActionResult<Confirmation>> {
  return runAction(async () => {
    if (!hasDatabase()) return fail("Not available.", undefined, 503)

    const number = rawNumber.trim().toUpperCase()
    if (!number) return fail("Order not found.", undefined, 404)

    const session = await optionalSession()
    const remembered = await rememberedOrder()

    const order = await db.order.findUnique({
      where: { number },
      select: {
        number: true,
        email: true,
        total: true,
        status: true,
        paymentMethod: true,
        placedAt: true,
        createdAt: true,
        userId: true,
        items: { select: { nameSnapshot: true, qty: true } },
      },
    })

    if (!order) return fail("Order not found.", undefined, 404)

    const ownsIt =
      remembered === order.number ||
      (Boolean(session?.user?.id) && order.userId === session?.user?.id)
    if (!ownsIt) return fail("Order not found.", undefined, 404)

    return ok({
      number: order.number,
      email: order.email,
      total: order.total.toString(),
      status: order.status,
      paymentMethod: order.paymentMethod,
      placedAt: (order.placedAt ?? order.createdAt).toISOString(),
      itemCount: order.items.reduce((sum, i) => sum + i.qty, 0),
      items: order.items.map((i) => ({ name: i.nameSnapshot, qty: i.qty })),
    })
  })
}
