import "server-only"

import { couponReduction, priceCart } from "@/features/cart/server/cart-pricing"
import { splitPayment, type PaymentMethod } from "@/features/checkout/payment-options"
import { placeOrderSchema, verifyPaymentSchema } from "@/features/checkout/schemas/checkout.schema"
import { offeredMethods } from "@/features/checkout/server/payment-options.service"
import {
  captureGatewayPayment,
  createGatewayOrder,
  fetchOrderPayments,
  fetchPayment,
  gatewayUnreachable,
  isGatewayConfigured,
  modeOfPayment,
  verifyPaymentSignature,
} from "@/features/checkout/server/payment-gateway"
import {
  claimCouponUse,
  COUPON_UNUSABLE,
  couponIsLive,
  minimumSpendMessage,
} from "@/features/coupons/server/coupon-rules"
import { paymentConfig } from "@/features/settings/server/runtime-settings"
import {
  attachCustomer,
  rememberCustomerDetails,
} from "@/features/customers/server/customers.service"
import { rememberOrder, rememberedOrder } from "@/features/checkout/server/recent-order"
import { renderOrderConfirmed } from "@/features/orders/emails/order-confirmed"
import {
  checkPincode,
  collectsOnDelivery,
  queueShiprocketOrder,
} from "@/features/shipping/server/shipping.service"
import { attachOrderToVisitor } from "@/features/visitors/server/tracking.service"
import type { PaymentMode } from "@/features/settings/schemas/runtime-settings.schema"
import { sendMail } from "@/lib/mailer"
import { orderNumber } from "@/lib/crypto"
import { hasDatabase } from "@/lib/env"
import { ConflictError } from "@/lib/errors"
import { rateLimit } from "@/lib/rate-limit"
import { createAuditLog, getAuditMeta } from "@/server/audit"
import { fail, ok, runAction, type ActionResult } from "@/server/action-result"
import { optionalSession } from "@/server/action-guard"
import { db } from "@/server/db"
import { later } from "@/server/later"

export type StartedCheckout = {
  orderId: string
  orderNumber: string
  total: string
  /** What Razorpay takes now: the total, the advance, or 0 for cash on delivery. */
  payNow: string
  /** Null for COD - nothing to hand the gateway. */
  gatewayOrderId: string | null
  gatewayKeyId: string | null
  paymentMethod: PaymentMethod
}

/** The ways of paying that take money through Razorpay when the order is placed. */
const PAYS_ONLINE: PaymentMethod[] = ["ONLINE", "PARTIAL"]

/**
 * True only for a unique-constraint violation on the order number.
 *
 * Checked structurally rather than with `instanceof`, so it does not depend on
 * which Prisma entrypoint happened to construct the error. It used to read
 * only `meta.target`, which Prisma 7's driver adapters do not fill in - the
 * column arrives under `meta.driverAdapterError`, or only in the message - so
 * the retry below never fired. Now the whole error is searched for the
 * `number` column or the `orders_number_key` index, as a whole word, so
 * `invoice_number` and every other unique index still never retry.
 */
export function isDuplicateNumber(err: unknown): boolean {
  if (!err || typeof err !== "object") return false
  if ((err as { code?: unknown }).code !== "P2002") return false

  let described = err instanceof Error ? err.message : ""
  try {
    described += ` ${JSON.stringify((err as { meta?: unknown }).meta ?? null)}`
  } catch {
    // A circular meta: the message alone will have to do.
  }
  return /orders_number_key|(^|[^A-Za-z0-9_])number([^A-Za-z0-9_]|$)/.test(described)
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
 * How many unpaid online orders one email or phone may hold at once.
 *
 * Every order takes its stock the moment it is written and keeps it for the
 * hour above, so without a ceiling one script could place order after order
 * and take the whole shop off sale without paying for any of it. Three is
 * more than a real buyer retrying a declined card ever needs.
 */
const OPEN_UNPAID_LIMIT = 3

/**
 * How many cash-on-delivery orders one email or phone may have waiting to be
 * sent, and how many one address may place in an hour.
 *
 * A COD order takes its stock the moment it is written and nothing gives it
 * back by itself - there is no payment to wait an hour for - so these are the
 * only ceiling on someone ordering the shop empty without paying a rupee.
 * Staff cancel the ones that turn out not to be real.
 */
const OPEN_COD_LIMIT = 2
const COD_PER_HOUR = 6

/** Stale orders looked at per run, and how long each Razorpay question may take. */
const STALE_BATCH = 10
const GATEWAY_CHECK_MS = 5_000

/**
 * One run at a time per process, so a burst of checkouts does not ask
 * Razorpay ten times over - and, per order, when Razorpay could not answer
 * about it, when to ask again. Without that pause the oldest few orders
 * Razorpay cannot answer for would fill every batch, and nothing behind them
 * would ever be released.
 */
const releasing = globalThis as unknown as {
  skelmetReleasingStale?: boolean
  skelmetStaleRetryAt?: Map<string, number>
}
const retryAt = (releasing.skelmetStaleRetryAt ??= new Map<string, number>())
const RETRY_AFTER_MS = 10 * 60_000

function ordersToSkip(now: number): string[] {
  for (const [id, at] of retryAt) if (at <= now) retryAt.delete(id)
  // Bounded, so the query's NOT IN stays small whatever happens.
  while (retryAt.size > 500) retryAt.delete(retryAt.keys().next().value!)
  return [...retryAt.keys()]
}

type GatewayVerdict =
  | { kind: "paid"; gatewayOrderId: string; gatewayPaymentId: string }
  | { kind: "unpaid" }
  | { kind: "unknown" }

/**
 * Whether Razorpay took money for an order we were about to call abandoned.
 *
 * A payment can be captured at Razorpay while neither the browser's /verify
 * nor the webhook ever reaches us - a closed tab, a webhook misconfigured or
 * down. Cancelling such an order on the clock kept the customer's money on
 * an order that would never ship. So before one is cancelled, Razorpay is
 * asked; any doubt - a timeout, an error, keys that cannot be read - is
 * "unknown", which leaves the order for the next run rather than cancelling
 * one that may be paid.
 */
async function paidAtGateway(
  payments: { gatewayOrderId: string; mode: string | null }[],
  ms: number,
): Promise<GatewayVerdict> {
  // Never reached Razorpay at all: nothing there to have been paid.
  if (payments.length === 0) return { kind: "unpaid" }

  try {
    const config = await paymentConfig()
    for (const row of payments) {
      const mode = modeOfPayment(row.mode, config)
      const attempts = await fetchOrderPayments(row.gatewayOrderId, mode, ms)
      const captured = attempts.find((p) => p.status === "captured")
      if (captured) {
        return { kind: "paid", gatewayOrderId: row.gatewayOrderId, gatewayPaymentId: captured.id }
      }
      const authorized = attempts.find((p) => p.status === "authorized")
      if (authorized) {
        await captureGatewayPayment(authorized, mode, ms)
        return {
          kind: "paid",
          gatewayOrderId: row.gatewayOrderId,
          gatewayPaymentId: authorized.id,
        }
      }
    }
    return { kind: "unpaid" }
  } catch (err) {
    console.error("[CHECKOUT] could not ask Razorpay about a stale order", err)
    return { kind: "unknown" }
  }
}

/**
 * Hands back the stock and coupon uses of online orders that were never paid.
 *
 * Every checkout claims stock and a coupon use when the order is written, and
 * only a gateway error on the spot used to release them - a customer who simply
 * closed the payment window, or whose card was declined, left the order PENDING
 * with its units held forever. There is no scheduler on this server, so this
 * runs lazily: at the start of every checkout, which is exactly when held stock
 * would turn a buyer away, and when staff open the orders list.
 *
 * Bounded: ten orders a run, and `budgetMs` in all, so a slow Razorpay costs
 * the checkout that triggered it seconds at most. What is not reached is left
 * for the next run, still holding its stock - never cancelled blind.
 */
export async function releaseStaleOrders(options: { budgetMs?: number } = {}): Promise<void> {
  if (!hasDatabase()) return
  if (releasing.skelmetReleasingStale) return
  releasing.skelmetReleasingStale = true
  const deadline = Date.now() + (options.budgetMs ?? 5_000)

  try {
    const skip = ordersToSkip(Date.now())
    const stale = await db.order.findMany({
      where: {
        status: "PENDING",
        paymentMethod: { in: PAYS_ONLINE },
        createdAt: { lt: new Date(Date.now() - UNPAID_HOLD_MS) },
        ...(skip.length ? { id: { notIn: skip } } : {}),
      },
      select: {
        id: true,
        number: true,
        couponId: true,
        items: { select: { variantId: true, qty: true } },
        payments: {
          where: { gateway: "razorpay" },
          select: { gatewayOrderId: true, mode: true },
        },
      },
      orderBy: { createdAt: "asc" },
      take: STALE_BATCH,
    })

    for (const order of stale) {
      const remaining = deadline - Date.now()
      if (remaining <= 0) break

      const verdict = await paidAtGateway(order.payments, Math.min(GATEWAY_CHECK_MS, remaining))
      if (verdict.kind === "unknown") {
        retryAt.set(order.id, Date.now() + RETRY_AFTER_MS)
        continue
      }

      if (verdict.kind === "paid") {
        const captured = await capturePayment({
          gatewayOrderId: verdict.gatewayOrderId,
          gatewayPaymentId: verdict.gatewayPaymentId,
          source: "reconcile",
        })
        if (captured) {
          await createAuditLog(null, {
            action: "payment:reconciled",
            module: "order",
            entityId: order.id,
            meta: { number: order.number, gatewayPaymentId: verdict.gatewayPaymentId },
          })
        }
        continue
      }

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
  } finally {
    releasing.skelmetReleasingStale = false
  }
}

/**
 * Places the order and, unless it is cash on delivery, opens a Razorpay order
 * for what is paid now - all of it, or the advance.
 *
 * The client sends SKUs, quantities and the way of paying it chose. Prices,
 * any coupon, the charge for paying on delivery and the advance are worked
 * out here from the database and the console's settings, so a tampered cart
 * cannot change what is charged.
 */
export async function placeOrder(raw: unknown): Promise<ActionResult<StartedCheckout>> {
  return runAction(async () => {
    const input = placeOrderSchema.parse(raw)
    if (!hasDatabase()) return fail("Checkout is not available yet.", undefined, 503)
    const email = input.email.toLowerCase()
    const method = input.paymentMethod
    const paysOnline = PAYS_ONLINE.includes(method)

    // Whether this buyer is offered this way of paying at all. The page only
    // shows what is on offer, but the page is only a courtesy.
    const chosen = (await offeredMethods()).methods.find((m) => m.id === method)
    if (!chosen) {
      return fail(
        "That way of paying is not available. Choose another and try again.",
        undefined,
        422,
      )
    }

    // Then, before any stock is looked at or Shiprocket asked: the ceiling on
    // orders one buyer may hold without having paid for them
    // (OPEN_UNPAID_LIMIT, OPEN_COD_LIMIT).
    if (paysOnline) {
      const openUnpaid = await db.order.count({
        where: {
          status: "PENDING",
          paymentMethod: { in: PAYS_ONLINE },
          createdAt: { gte: new Date(Date.now() - UNPAID_HOLD_MS) },
          OR: [{ email }, { phone: input.phone }],
        },
      })
      if (openUnpaid >= OPEN_UNPAID_LIMIT) {
        return fail(
          "You already have orders waiting to be paid for. Finish paying for one of those, or try again in an hour.",
          undefined,
          409,
        )
      }
    } else {
      const openCod = await db.order.count({
        where: {
          paymentMethod: "COD",
          status: { in: ["CONFIRMED", "PACKED"] },
          OR: [{ email }, { phone: input.phone }],
        },
      })
      if (openCod >= OPEN_COD_LIMIT) {
        return fail(
          "You already have cash-on-delivery orders waiting to be sent. Place another once one is on its way, or pay for this one online.",
          undefined,
          409,
        )
      }
      rateLimit(`cod-order:${(await getAuditMeta()).ip}`, COD_PER_HOUR, 60 * 60_000)
    }

    // The checkout page has already told the buyer this, but the page is only
    // a courtesy: a paid order no courier can reach is money to refund and a
    // customer to disappoint. Only a definite no refuses - Shiprocket being
    // down, slow or not set up must never stop a sale - and the answer is
    // cached, usually from the page's own check a moment ago.
    //
    // The same answer carries the shipping fee, asked for this order's own
    // parcel - the page asks with the same count, so the fee it showed is the
    // fee charged. No answer means no fee, as it means no refusal.
    const pin = input.address.pincode
    const units = input.items.reduce((n, i) => n + i.qty, 0)
    const reach = await checkPincode({ pincode: pin, units })
    const shippingFee = reach.ok ? reach.data.shippingFee : 0
    if (reach.ok && reach.data.live && !reach.data.serviceable) {
      return fail(
        reach.data.found
          ? `Couriers don't reach pincode ${pin} yet, so we can't take this order. Message us and we'll try to arrange it.`
          : `We couldn't find pincode ${pin}. Check the number and try again.`,
        undefined,
        422,
      )
    }

    // Paying at the door needs a courier that collects there. Again only a
    // definite no refuses; not knowing leaves it to booking to find out.
    if (method !== "ONLINE" && (await collectsOnDelivery(pin, units)) === false) {
      return fail(
        `Couriers don't collect payment at pincode ${pin}, so this order has to be paid for online.`,
        undefined,
        422,
      )
    }

    // Before the stock check, so units held by abandoned orders are back on
    // sale for this buyer. A short budget: a slow Razorpay must not hold up
    // the buyer who is here now.
    await releaseStaleOrders({ budgetMs: 3_000 })

    const session = await optionalSession()

    const variants = await db.variant.findMany({
      where: { sku: { in: input.items.map((i) => i.sku) } },
      select: {
        id: true,
        sku: true,
        price: true,
        stock: true,
        colourway: true,
        product: { select: { name: true, status: true } },
      },
    })

    // A draft or archived product is not for sale, whatever its variants'
    // stock says - the SKU alone used to be enough to buy one.
    if (
      variants.length !== input.items.length ||
      variants.some((v) => v.product.status !== "ACTIVE")
    ) {
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
          archivedAt: true,
        },
      })

      // The same answers as the cart's own check (coupons.service), so the
      // two cannot be played against each other to learn which codes exist.
      if (!coupon || !couponIsLive(coupon)) return fail(COUPON_UNUSABLE, undefined, 422)

      couponOff = couponReduction(coupon, base.subtotal)
      if (couponOff <= 0) return fail(minimumSpendMessage(coupon.minSubtotal), undefined, 422)
      couponId = coupon.id
    }

    // Before the transaction, not after: failing here once the order exists
    // leaves an orphan holding stock nobody can buy.
    if (paysOnline && !(await isGatewayConfigured())) {
      return fail("Payments are temporarily unavailable. Please try again shortly.", undefined, 503)
    }

    // The charge for paying this way is the console's, as is the advance;
    // checkout showed both from the same settings and the same arithmetic.
    const priced = priceCart(lines, { couponOff, shippingFee, paymentFee: chosen.fee })
    const split = splitPayment(method, priced.total, chosen.advance)
    if (!split) {
      return fail(
        "This order is too small to split into an advance and a balance. Choose another way to pay.",
        undefined,
        422,
      )
    }
    if (method === "COD" && split.dueOnDelivery < 1) {
      return fail(
        "There is nothing to collect on this order, so it cannot be cash on delivery.",
        undefined,
        422,
      )
    }

    // ── write the order and claim stock in one transaction ──
    const writeOrder = (number: string) =>
      db.$transaction(async (tx) => {
        // Who bought, before the order row, so it can point at them. A guest
        // checkout still produces a customer: there is no signup here, so this
        // is the only moment the shop ever learns who someone is. Their
        // details are saved once the order is paid, not now.
        const customerId = await attachCustomer(tx, { email })

        const created = await tx.order.create({
          data: {
            number,
            paymentMethod: method,
            // A signed-in staff id wins when there is one, so an admin placing an
            // order on someone's behalf still owns it. Otherwise the order points
            // at the customer record checkout just wrote.
            userId: session?.user?.id ?? customerId,
            // Cash on delivery is accepted as it is placed: there is no
            // payment to wait for. Anything paid online waits for its money.
            status: paysOnline ? "PENDING" : "CONFIRMED",
            email,
            phone: input.phone,
            shippingAddress: { ...input.address },
            subtotal: priced.subtotal,
            discount: priced.discount,
            shipping: priced.shipping,
            paymentFee: priced.paymentFee,
            tax: 0,
            total: priced.total,
            dueOnDelivery: split.dueOnDelivery,
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
        // Losing that race is the buyer's problem to know about, not a 500.
        for (const line of lines) {
          const claimed = await tx.variant.updateMany({
            where: { id: line.variant.id, stock: { gte: line.qty } },
            data: { stock: { decrement: line.qty } },
          })
          if (claimed.count === 0) {
            throw new ConflictError(
              `Someone else just bought the last of ${line.variant.product.name} in ${line.variant.colourway}. Check your cart and try again.`,
            )
          }
        }

        // The coupon's use is claimed here, conditionally, not merely counted:
        // the check above is only the friendly early answer (coupon-rules.ts).
        if (couponId && !(await claimCouponUse(tx, couponId))) {
          throw new ConflictError(`${COUPON_UNUSABLE} Remove it and try again.`)
        }

        return created
      })

    // SKM-YYYY-XXXX draws 4 characters from a 32-letter alphabet, so a year's
    // numbers collide with each other at about a one-in-a-million chance per
    // pair - rare, and `number` is @unique, so the loser used to get a raw
    // P2002 rendered as "Something went wrong" after their card was already
    // charged. A fresh number costs nothing; only a genuine duplicate retries,
    // and an out-of-stock or coupon refusal still aborts on the first attempt.
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
    let gatewayKeyId: string | null = null
    if (paysOnline) {
      try {
        const gw = await createGatewayOrder({
          amountRupees: split.payNow,
          receipt: order.number,
          notes: { orderId: order.id, orderNumber: order.number },
        })
        gatewayOrderId = gw.order.id
        gatewayKeyId = gw.keyId

        await db.payment.create({
          data: {
            orderId: order.id,
            gateway: "razorpay",
            gatewayOrderId: gw.order.id,
            status: "CREATED",
            amount: split.payNow,
            mode: gw.mode,
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
      meta: {
        number: order.number,
        total: priced.total,
        method,
        payNow: split.payNow,
        dueOnDelivery: split.dueOnDelivery,
      },
      ...(await getAuditMeta()),
    })

    // The one moment we know for certain this browser owns this order.
    await rememberOrder(order.number)

    // And which visitor it was, when they accepted cookies. Best effort: it
    // swallows its own failures, so it can never cost the sale.
    await attachOrderToVisitor({
      orderId: order.id,
      email: input.email,
      phone: input.phone,
      name: `${input.address.firstName} ${input.address.lastName}`.trim(),
    })

    // An order paid online is real when its payment clears, so confirmPayment
    // and the webhook own its receipt: sending one here would confirm an
    // abandoned payment page. Cash on delivery is real now - nothing more
    // comes from the buyer until the door - so what a capture does for a paid
    // order is done here for it.
    if (method === "COD") {
      await rememberCustomerDetails(order.id)

      const mail = renderOrderConfirmed({
        number: order.number,
        email,
        total: order.total.toString(),
        paymentMethod: "COD",
        dueOnDelivery: String(split.dueOnDelivery),
        items: lines.map((l) => ({
          name: `${l.variant.product.name} · ${l.variant.colourway}`,
          qty: l.qty,
        })),
      })
      later(async () => {
        await sendMail({ to: email, ...mail })
      })

      queueShiprocketOrder(order.id)
    }

    return ok({
      orderId: order.id,
      orderNumber: order.number,
      total: order.total.toString(),
      payNow: String(split.payNow),
      gatewayOrderId,
      gatewayKeyId,
      paymentMethod: method,
    })
  })
}

/**
 * Records a captured payment and marks its order paid - the one place the
 * browser's /verify, the Razorpay webhook and the stale-order check all do
 * this.
 *
 * The order is found through the payment row for this Razorpay order, never
 * through anything the caller names. /verify used to mark whichever `orderId`
 * the browser sent once the signature checked out, and the signature only
 * proves a payment for ONE Razorpay order: paying for a cheap order and sending
 * an expensive order's id marked the expensive one paid.
 *
 * The payment row is the claim. The first capture to flip it from unpaid, by
 * any path, does the work and sends the receipt; every later arrival - the
 * other path, a webhook redelivery - finds it CAPTURED and does nothing. The
 * claim and the order update share a transaction, so a crash between them
 * cannot leave a captured payment on an unpaid order with nothing to retry.
 *
 * An order that was cancelled before its money arrived - released after sitting
 * unpaid (`releaseStaleOrders`), or cancelled by hand - is revived rather than
 * left cancelled with the customer's money held. Its stock is taken again
 * without the usual floor: the customer has paid, so if the units were re-sold
 * in the meantime the variant goes negative, which is the honest signal that
 * the shop owes one more than it has. Its coupon use is claimed again the same
 * way: conditionally, and when the code has since run out or expired, counted
 * anyway and audited, because the discount was already paid for.
 */
async function capturePayment(input: {
  gatewayOrderId: string
  gatewayPaymentId: string | null
  source: "browser" | "webhook" | "reconcile"
}): Promise<{ orderId: string; number: string; status: string } | null> {
  const payment = await db.payment.findUnique({
    where: {
      gateway_gatewayOrderId: { gateway: "razorpay", gatewayOrderId: input.gatewayOrderId },
    },
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
    if (first.count === 0) return { kind: "already" as const }

    const paid = await tx.order.updateMany({
      where: { id: payment.orderId, status: "PENDING" },
      data: { status: "PAID", placedAt: new Date() },
    })
    if (paid.count > 0) return { kind: "paid" as const }

    const order = await tx.order.findUnique({
      where: { id: payment.orderId },
      select: { status: true, couponId: true, items: { select: { variantId: true, qty: true } } },
    })
    if (order?.status !== "CANCELLED") return { kind: "untouched" as const }

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
    let couponOverLimit = false
    if (order.couponId && !(await claimCouponUse(tx, order.couponId))) {
      couponOverLimit = true
      await tx.coupon.update({
        where: { id: order.couponId },
        data: { usedCount: { increment: 1 } },
      })
    }
    return { kind: "revived" as const, couponOverLimit }
  })

  const order = await db.order.findUnique({
    where: { id: payment.orderId },
    select: {
      number: true,
      status: true,
      email: true,
      total: true,
      paymentMethod: true,
      dueOnDelivery: true,
      couponId: true,
      items: { select: { nameSnapshot: true, qty: true } },
    },
  })
  if (!order) return null

  if (outcome.kind === "paid" || outcome.kind === "revived") {
    await createAuditLog(null, {
      action: outcome.kind === "revived" ? "order:revived-by-payment" : "order:paid",
      module: "order",
      entityId: payment.orderId,
      meta: { gatewayPaymentId: input.gatewayPaymentId, source: input.source },
    })
    if (outcome.kind === "revived" && outcome.couponOverLimit) {
      await createAuditLog(null, {
        action: "coupon:over-limit",
        module: "coupon",
        entityId: order.couponId ?? undefined,
        meta: { orderId: payment.orderId, number: order.number },
      })
    }

    // Paid, so now - and only now - the order's name, phone and address are
    // saved onto its customer (see attachCustomer).
    await rememberCustomerDetails(payment.orderId)

    // The receipt after the response: a slow or unreachable mail server must
    // not hold up the payment confirmation the customer is waiting on.
    const mail = renderOrderConfirmed({
      number: order.number,
      email: order.email,
      total: order.total.toString(),
      // Money came through the gateway, so this is never the cash-on-delivery
      // wording, whatever the order's method field says.
      paymentMethod: order.paymentMethod === "PARTIAL" ? "PARTIAL" : "ONLINE",
      dueOnDelivery: order.paymentMethod === "PARTIAL" ? order.dueOnDelivery.toString() : "0",
      items: order.items.map((i) => ({ name: i.nameSnapshot, qty: i.qty })),
    })
    const to = order.email
    later(async () => {
      await sendMail({ to, ...mail })
    })

    // Into Shiprocket after the response, so it is ready when staff book the
    // courier. Best effort: booking sends it if this does not.
    queueShiprocketOrder(payment.orderId)
  } else if (outcome.kind === "untouched") {
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
 * What Razorpay itself says about a payment whose signature checked out.
 *
 * A valid signature proves Razorpay handed this browser that (order, payment)
 * pair, not that the money moved: an account set to capture by hand leaves a
 * successful payment `authorized`, held rather than taken. So the payment is
 * read back, captured if it is only authorised, and the order is marked paid
 * only once it is captured. "unreachable" - Razorpay timing out or failing -
 * falls back to the signature alone, as before, and is audited.
 */
async function confirmAtGateway(
  gatewayPaymentId: string,
  gatewayOrderId: string,
  mode: PaymentMode,
): Promise<"paid" | "not-paid" | "unreachable"> {
  let payment
  try {
    payment = await fetchPayment(gatewayPaymentId, mode)
  } catch (err) {
    console.error("[PAYMENT] could not read the payment back from Razorpay", err)
    return gatewayUnreachable(err) ? "unreachable" : "not-paid"
  }

  if (payment.order_id && payment.order_id !== gatewayOrderId) return "not-paid"
  if (payment.status === "captured") return "paid"
  if (payment.status !== "authorized") return "not-paid"

  try {
    await captureGatewayPayment(payment, mode)
    return "paid"
  } catch (err) {
    // Razorpay's own automatic capture may have got there first.
    try {
      const again = await fetchPayment(gatewayPaymentId, mode)
      if (again.status === "captured") return "paid"
    } catch {
      // Reported below.
    }
    console.error("[PAYMENT] could not capture an authorised payment", gatewayPaymentId, err)
    return gatewayUnreachable(err) ? "unreachable" : "not-paid"
  }
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

    // Checked with the secret of the account the payment was opened on, which
    // is not necessarily the one switched on now.
    const opened = await db.payment.findUnique({
      where: {
        gateway_gatewayOrderId: { gateway: "razorpay", gatewayOrderId: input.gatewayOrderId },
      },
      select: { mode: true, orderId: true },
    })
    const mode = modeOfPayment(opened?.mode, await paymentConfig())

    if (!(await verifyPaymentSignature(input, mode))) {
      // One row, and none of the ids the caller sent: they are whatever the
      // caller chose, and writing them under an order's entity id let anyone
      // fill any order's audit trail with forged failures.
      await createAuditLog(null, {
        action: "payment:signature-invalid",
        module: "order",
        ...(await getAuditMeta()),
      })
      return fail("We could not verify that payment.", undefined, 422)
    }

    const at = await confirmAtGateway(input.gatewayPaymentId, input.gatewayOrderId, mode)
    if (at === "not-paid") {
      await createAuditLog(null, {
        action: "payment:not-captured",
        module: "order",
        entityId: opened?.orderId,
        meta: { gatewayOrderId: input.gatewayOrderId, gatewayPaymentId: input.gatewayPaymentId },
      })
      return fail(
        "Razorpay has not confirmed that payment yet. If money has left your account, your order will be confirmed as soon as it does.",
        undefined,
        409,
      )
    }
    if (at === "unreachable") {
      await createAuditLog(null, {
        action: "payment:confirmed-by-signature-only",
        module: "order",
        entityId: opened?.orderId,
        meta: { gatewayOrderId: input.gatewayOrderId, gatewayPaymentId: input.gatewayPaymentId },
      })
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
        entityId: captured.orderId,
        meta: { gatewayOrderId: input.gatewayOrderId, claimedOrderId: input.orderId },
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

    const payment = await db.payment.findUnique({
      where: { gateway_gatewayOrderId: { gateway: "razorpay", gatewayOrderId } },
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
  /** The charge for paying on delivery, part of `total`. */
  paymentFee: string
  /** What the courier collects: the total for COD, the balance for PARTIAL. */
  dueOnDelivery: string
  status: string
  paymentMethod: PaymentMethod
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
        paymentFee: true,
        dueOnDelivery: true,
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
      paymentFee: order.paymentFee.toString(),
      dueOnDelivery: order.dueOnDelivery.toString(),
      status: order.status,
      paymentMethod: order.paymentMethod,
      placedAt: (order.placedAt ?? order.createdAt).toISOString(),
      itemCount: order.items.reduce((sum, i) => sum + i.qty, 0),
      items: order.items.map((i) => ({ name: i.nameSnapshot, qty: i.qty })),
    })
  })
}
