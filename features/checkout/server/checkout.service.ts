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
import { queueShiprocketOrder } from "@/features/shipping/server/shipping.service"
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
  /** Null for COD - nothing to hand the gateway. */
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
 * releases cannot both restock the same lines - whoever flips it wins and the
 * loser returns having done nothing. All of it rides one transaction because a
 * half-undo is worse than none: stock back while the order is still PENDING
 * would let it be paid for goods that have already been re-sold.
 */
async function releaseOrder(input: {
  orderId: string
  lines: { variant: { id: string }; qty: number }[]
  couponId: string | null
}): Promise<boolean> {
  try {
    return await db.$transaction(async (tx) => {
      const claimed = await tx.order.updateMany({
        where: { id: input.orderId, status: "PENDING" },
        data: { status: "CANCELLED" },
      })
      if (claimed.count === 0) return false

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
      return true
    })
  } catch (err) {
    // A cleanup that fails must not replace the gateway error the customer is
    // waiting on. The order stays PENDING and an admin can cancel it, which
    // restocks down this same path.
    console.error("[CHECKOUT] release failed for", input.orderId, err)
    return false
  }
}

/**
 * How long an unpaid online order may hold its stock and coupon use.
 *
 * Long enough for any real payment to finish - a UPI collect request lives
 * about fifteen minutes, a slow netbanking redirect a few more - and short
 * enough that a closed payment window does not take a unit off sale for good.
 * A payment that lands after this still counts: capturePayment revives the
 * order rather than leaving the money on a cancelled one.
 */
const UNPAID_HOLD_MS = 60 * 60_000

/**
 * Hands back the stock and coupon uses of online orders that were never paid.
 *
 * Every checkout claims stock and a coupon use when the order is written, and
 * only a gateway error on the spot used to release them - a customer who simply
 * closed the payment window, or whose card was declined, left the order PENDING
 * with its units held forever. There is no scheduler on this server, so this
 * runs lazily: at the start of every checkout, which is exactly when held stock
 * would turn a buyer away, and when staff open the orders list.
 */
export async function releaseStaleOrders(): Promise<void> {
  if (!hasDatabase()) return
  try {
    const stale = await db.order.findMany({
      where: {
        status: "PENDING",
        paymentMethod: "ONLINE",
        createdAt: { lt: new Date(Date.now() - UNPAID_HOLD_MS) },
      },
      select: {
        id: true,
        number: true,
        couponId: true,
        items: { select: { variantId: true, qty: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 50,
    })
    for (const order of stale) {
      const released = await releaseOrder({
        orderId: order.id,
        lines: order.items.map((i) => ({ variant: { id: i.variantId }, qty: i.qty })),
        couponId: order.couponId,
      })
      if (released) {
        await createAuditLog(null, {
          action: "order:expire",
          module: "order",
          entityId: order.id,
          meta: { number: order.number, heldForMinutes: UNPAID_HOLD_MS / 60_000 },
        })
      }
    }
  } catch (err) {
    // Housekeeping. It must never be the reason a checkout fails.
    console.error("[CHECKOUT] releasing stale orders failed", err)
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

    // Before the stock check, so units held by abandoned orders are back on
    // sale for this buyer.
    await releaseStaleOrders()

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
      return fail("Payments are temporarily unavailable. Please try again shortly.", undefined, 503)
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

        // Atomic claim per line - a concurrent order cannot oversell (§5).
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
    // pair - rare, and `number` is @unique, so the loser used to get a raw
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
    // rolled back - it has to be compensated. The isGatewayConfigured() check
    // further up only proves the keys are PRESENT; Razorpay can still refuse
    // the call itself, and does: rejected credentials answer 401, and an
    // outage or a dropped connection never answers at all. Every one of those
    // used to leave exactly the orphan that check was written to prevent - a
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
    // an order is no longer a commitment to anything - an order is real when
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
 * Records a captured payment and marks its order paid - the one place both the
 * browser's /verify and the Razorpay webhook do this.
 *
 * The order is found through the payment row for this Razorpay order, never
 * through anything the caller names. /verify used to mark whichever `orderId`
 * the browser sent once the signature checked out, and the signature only
 * proves a payment for ONE Razorpay order: paying for a cheap order and sending
 * an expensive order's id marked the expensive one paid.
 *
 * The payment row is the claim. The first capture to flip it from unpaid, by
 * either path, does the work and sends the receipt; every later arrival - the
 * other path, a webhook redelivery - finds it CAPTURED and does nothing. The
 * claim and the order update share a transaction, so a crash between them
 * cannot leave a captured payment on an unpaid order with nothing to retry.
 *
 * An order that was cancelled before its money arrived - released after sitting
 * unpaid (`releaseStaleOrders`), or cancelled by hand - is revived rather than
 * left cancelled with the customer's money held. Its stock is taken again
 * without the usual floor: the customer has paid, so if the units were re-sold
 * in the meantime the variant goes negative, which is the honest signal that
 * the shop owes one more than it has.
 */
async function capturePayment(input: {
  gatewayOrderId: string
  gatewayPaymentId: string | null
  source: "browser" | "webhook"
}): Promise<{ orderId: string; number: string; status: string } | null> {
  const payment = await db.payment.findFirst({
    where: { gatewayOrderId: input.gatewayOrderId },
    select: { id: true, orderId: true },
  })
  if (!payment) return null

  const outcome = await db.$transaction(async (tx) => {
    const first = await tx.payment.updateMany({
      where: { id: payment.id, status: { in: ["CREATED", "AUTHORIZED", "FAILED"] } },
      data: {
        status: "CAPTURED",
        ...(input.gatewayPaymentId ? { gatewayPaymentId: input.gatewayPaymentId } : {}),
      },
    })
    if (first.count === 0) return "already" as const

    const paid = await tx.order.updateMany({
      where: { id: payment.orderId, status: "PENDING" },
      data: { status: "PAID", placedAt: new Date() },
    })
    if (paid.count > 0) return "paid" as const

    const order = await tx.order.findUnique({
      where: { id: payment.orderId },
      select: { status: true, couponId: true, items: { select: { variantId: true, qty: true } } },
    })
    if (order?.status !== "CANCELLED") return "untouched" as const

    await tx.order.update({
      where: { id: payment.orderId },
      data: { status: "PAID", placedAt: new Date() },
    })
    for (const item of order.items) {
      await tx.variant.update({
        where: { id: item.variantId },
        data: { stock: { decrement: item.qty } },
      })
    }
    if (order.couponId) {
      await tx.coupon.update({
        where: { id: order.couponId },
        data: { usedCount: { increment: 1 } },
      })
    }
    return "revived" as const
  })

  const order = await db.order.findUnique({
    where: { id: payment.orderId },
    select: {
      number: true,
      status: true,
      email: true,
      total: true,
      items: { select: { nameSnapshot: true, qty: true } },
    },
  })
  if (!order) return null

  if (outcome === "paid" || outcome === "revived") {
    await createAuditLog(null, {
      action: outcome === "revived" ? "order:revived-by-payment" : "order:paid",
      module: "order",
      entityId: payment.orderId,
      meta: { gatewayPaymentId: input.gatewayPaymentId, source: input.source },
    })

    const mail = renderOrderConfirmed({
      number: order.number,
      email: order.email,
      total: order.total.toString(),
      paymentMethod: "ONLINE",
      items: order.items.map((i) => ({ name: i.nameSnapshot, qty: i.qty })),
    })
    await sendMail({ to: order.email, ...mail })

    // Into Shiprocket after the response, so it is ready when staff book the
    // courier. Best effort: booking sends it if this does not.
    queueShiprocketOrder(payment.orderId)
  } else if (outcome === "untouched") {
    // Money captured against an order in a state nothing here should move -
    // refunded, say. Loud, so someone looks at it.
    console.error("[PAYMENT] captured against order in", order.status, payment.orderId)
    await createAuditLog(null, {
      action: "payment:captured-unexpected",
      module: "order",
      entityId: payment.orderId,
      meta: { gatewayPaymentId: input.gatewayPaymentId, status: order.status },
    })
  }

  return { orderId: payment.orderId, number: order.number, status: order.status }
}

/**
 * Called by the browser after Razorpay's handler fires. The webhook is the
 * source of truth; this exists so the customer sees confirmation immediately
 * instead of waiting on a server-to-server round trip.
 *
 * `orderId` in the body is not used to decide anything - see capturePayment.
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

    const captured = await capturePayment({
      gatewayOrderId: input.gatewayOrderId,
      gatewayPaymentId: input.gatewayPaymentId,
      source: "browser",
    })
    if (!captured) return fail("Order not found.", undefined, 404)

    if (captured.orderId !== input.orderId) {
      await createAuditLog(null, {
        action: "payment:order-mismatch",
        module: "order",
        entityId: input.orderId,
        meta: { gatewayOrderId: input.gatewayOrderId, paidOrderId: captured.orderId },
      })
    }

    return ok({ orderNumber: captured.number, status: captured.status })
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

    if (event.event === "payment.captured") {
      const captured = await capturePayment({
        gatewayOrderId,
        gatewayPaymentId: gatewayPaymentId ?? null,
        source: "webhook",
      })
      return ok({ handled: Boolean(captured) })
    }

    const payment = await db.payment.findFirst({
      where: { gatewayOrderId },
      select: { id: true, orderId: true },
    })
    if (!payment) return ok({ handled: false })

    if (event.event === "payment.failed") {
      // Conditional on CREATED, the same way the capture above claims PENDING.
      //
      // A customer whose first card is declined and whose second succeeds
      // generates BOTH events, and Razorpay does not promise the order they
      // arrive in. An unconditional write here let a late failure land on a
      // row that had already been captured - flipping a paid order's payment
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
 * existed all answer the same 404 - anything else turns this into an oracle
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
