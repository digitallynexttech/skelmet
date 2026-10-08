import "server-only"

import { couponReduction, priceCart } from "@/features/cart/server/cart-pricing"
import { splitPayment, type PaymentMethod } from "@/features/checkout/payment-options"
import {
  placeOrderSchema,
  verifyPaymentSchema,
  type PlaceOrderInput,
} from "@/features/checkout/schemas/checkout.schema"
import { offeredMethods } from "@/features/checkout/server/payment-options.service"
import {
  activeGatewayKey,
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
 * Prisma 7's driver adapters leave `meta.target` empty, so the whole error is
 * searched for `number` as a whole word (not `invoice_number`) or `orders_number_key`.
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
 * Gives back the stock and coupon use of an unpaid order.
 *
 * The conditional PENDING claim goes first so two concurrent releases cannot
 * both restock. One transaction: a half-undo is worse than none.
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
    // Must not replace the error the customer is waiting on. The order stays
    // PENDING; an admin cancel restocks it.
    console.error("[CHECKOUT] release failed for", input.orderId, err)
    return false
  }
}

/**
 * How long an unpaid online order holds its stock and coupon use. Outlasts a UPI
 * collect request (~15 min); a later payment still counts (capturePayment revives).
 */
const UNPAID_HOLD_MS = 60 * 60_000

/** Unpaid online orders one email or phone may hold, so a script cannot hold all the stock. */
const OPEN_UNPAID_LIMIT = 3

const OPEN_UNPAID_REFUSAL =
  "You already have orders waiting to be paid for. Finish paying for one of those, or try again in an hour."

/** Max age of a reopenable unpaid order: well inside its hour, so it does not race release. */
const REOPEN_WITHIN_MS = UNPAID_HOLD_MS - 15 * 60_000

/** Payment rows that moved no money: an order with only these can take another attempt. */
const NO_MONEY_MOVED = ["CREATED", "FAILED"]

/** A buyer's unpaid online orders young enough to reopen, newest first. */
async function openAttempts(email: string, phone: string, method: PaymentMethod) {
  return db.order.findMany({
    where: {
      status: "PENDING",
      paymentMethod: method,
      email,
      phone,
      createdAt: { gte: new Date(Date.now() - REOPEN_WITHIN_MS) },
    },
    orderBy: { createdAt: "desc" },
    take: OPEN_UNPAID_LIMIT,
    select: {
      id: true,
      number: true,
      total: true,
      dueOnDelivery: true,
      couponId: true,
      items: { select: { qty: true, variant: { select: { sku: true } } } },
      payments: {
        where: { gateway: "razorpay" },
        orderBy: { createdAt: "desc" },
        select: { gatewayOrderId: true, status: true, amount: true, mode: true },
      },
    },
  })
}

type OpenAttempt = Awaited<ReturnType<typeof openAttempts>>[number]

const sameMoney = (a: { toString(): string } | number, b: { toString(): string } | number) =>
  Math.abs(Number(a.toString()) - Number(b.toString())) < 0.005

/** Same SKUs and quantities, in any order. */
function sameBasket(
  attempt: OpenAttempt,
  items: ReadonlyArray<{ sku: string; qty: number }>,
): boolean {
  const key = (list: Array<[string, number]>) =>
    list
      .map(([sku, qty]) => `${sku}:${qty}`)
      .sort()
      .join(",")
  return (
    key(attempt.items.map((i) => [i.variant.sku, i.qty])) === key(items.map((i) => [i.sku, i.qty]))
  )
}

/**
 * Reopens the buyer's open order for the same basket at the same price instead
 * of writing another; Razorpay takes any number of attempts on one order. The
 * new address is saved onto it. Never an order money has moved on, nor one
 * opened on the other Razorpay account.
 */
async function reopenUnpaidOrder(
  attempts: OpenAttempt[],
  input: {
    items: ReadonlyArray<{ sku: string; qty: number }>
    total: number
    payNow: number
    dueOnDelivery: number
    couponId: string | null
    address: PlaceOrderInput["address"]
    method: PaymentMethod
  },
): Promise<StartedCheckout | null> {
  if (attempts.length === 0) return null
  let key: { mode: PaymentMode; keyId: string }
  try {
    key = await activeGatewayKey()
  } catch {
    return null
  }

  for (const attempt of attempts) {
    const payment = attempt.payments[0]
    if (!payment || attempt.payments.some((p) => !NO_MONEY_MOVED.includes(p.status))) continue
    if (payment.mode !== key.mode) continue
    if (
      attempt.couponId !== input.couponId ||
      !sameBasket(attempt, input.items) ||
      !sameMoney(attempt.total, input.total) ||
      !sameMoney(attempt.dueOnDelivery, input.dueOnDelivery) ||
      !sameMoney(payment.amount, input.payNow)
    ) {
      continue
    }
    // Conditional, so an order paid or released this instant is left alone.
    const moved = await db.order.updateMany({
      where: { id: attempt.id, status: "PENDING" },
      data: { shippingAddress: { ...input.address } },
    })
    if (moved.count === 0) continue
    return {
      orderId: attempt.id,
      orderNumber: attempt.number,
      total: attempt.total.toString(),
      payNow: String(input.payNow),
      gatewayOrderId: payment.gatewayOrderId,
      gatewayKeyId: key.keyId,
      paymentMethod: input.method,
    }
  }
  return null
}

/**
 * COD orders one email or phone may have waiting to ship, and per IP per hour.
 * COD stock is never released by itself, so these are the only ceiling.
 */
const OPEN_COD_LIMIT = 2
const COD_PER_HOUR = 6

/** Stale orders looked at per run, and how long each Razorpay question may take. */
const STALE_BATCH = 10
const GATEWAY_CHECK_MS = 5_000

/**
 * One run at a time per process. Orders Razorpay could not answer for wait
 * before being asked again, so they cannot fill every batch.
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
 * Whether Razorpay took money for an order about to be called abandoned (/verify
 * and the webhook can both miss). Any doubt is "unknown": never cancel one that may be paid.
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
 * Hands back the stock and coupon uses of online orders never paid.
 *
 * No scheduler: runs lazily at each checkout and when staff open the orders
 * list. Bounded by STALE_BATCH and `budgetMs`; what is not reached waits.
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
    // Housekeeping must never fail a checkout.
    console.error("[CHECKOUT] releasing stale orders failed", err)
  } finally {
    releasing.skelmetReleasingStale = false
  }
}

/**
 * Places the order and, unless COD, opens a Razorpay order for what is paid now.
 * The client sends only SKUs, quantities and the method; every amount is priced
 * here, so a tampered cart cannot change the charge.
 */
export async function placeOrder(raw: unknown): Promise<ActionResult<StartedCheckout>> {
  return runAction(async () => {
    const input = placeOrderSchema.parse(raw)
    if (!hasDatabase()) return fail("Checkout is not available yet.", undefined, 503)
    const email = input.email.toLowerCase()
    const method = input.paymentMethod
    const paysOnline = PAYS_ONLINE.includes(method)

    // The page only shows what is on offer, but the page is only a courtesy.
    const chosen = (await offeredMethods()).methods.find((m) => m.id === method)
    if (!chosen) {
      return fail(
        "That way of paying is not available. Choose another and try again.",
        undefined,
        422,
      )
    }

    // Unpaid-order ceiling. A buyer at it whose basket matches an open order
    // goes on as a retry, and is refused below if it does not reopen.
    const attempts = paysOnline ? await openAttempts(email, input.phone, method) : []
    let atCeiling = false
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
        if (!attempts.some((a) => sameBasket(a, input.items))) {
          return fail(OPEN_UNPAID_REFUSAL, undefined, 409)
        }
        atCeiling = true
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

    // Only a definite no refuses: Shiprocket down or unset must never stop a
    // sale. The page asks with the same unit count, so the fee shown is the fee
    // charged; no answer means no fee.
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

    // Again only a definite no refuses.
    if (method !== "ONLINE" && (await collectsOnDelivery(pin, units)) === false) {
      return fail(
        `Couriers don't collect payment at pincode ${pin}, so this order has to be paid for online.`,
        undefined,
        422,
      )
    }

    // Before the stock check, so abandoned orders' units are back on sale.
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

    // A draft or archived product is not for sale, whatever its stock.
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

      // Same answers as the cart's check, so neither reveals which codes exist.
      if (!coupon || !couponIsLive(coupon)) return fail(COUPON_UNUSABLE, undefined, 422)

      couponOff = couponReduction(coupon, base.subtotal)
      if (couponOff <= 0) return fail(minimumSpendMessage(coupon.minSubtotal), undefined, 422)
      couponId = coupon.id
    }

    // Before the transaction, or a failure leaves an orphan holding stock.
    if (paysOnline && !(await isGatewayConfigured())) {
      return fail("Payments are temporarily unavailable. Please try again shortly.", undefined, 503)
    }

    // Fee and advance come from the console's settings, as the page showed them.
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

    // ── or pay again for the order already open ─────────────
    if (paysOnline) {
      const reopened = await reopenUnpaidOrder(attempts, {
        items: input.items,
        total: priced.total,
        payNow: split.payNow,
        dueOnDelivery: split.dueOnDelivery,
        couponId,
        address: input.address,
        method,
      })
      if (reopened) {
        await createAuditLog(session, {
          action: "order:reopen",
          module: "order",
          entityId: reopened.orderId,
          meta: { number: reopened.orderNumber, payNow: split.payNow },
          ...(await getAuditMeta()),
        })
        await rememberOrder(reopened.orderNumber)
        await attachOrderToVisitor({
          orderId: reopened.orderId,
          email: input.email,
          phone: input.phone,
          name: `${input.address.firstName} ${input.address.lastName}`.trim(),
        })
        return ok(reopened)
      }
      if (atCeiling) return fail(OPEN_UNPAID_REFUSAL, undefined, 409)
    }

    // ── write the order and claim stock in one transaction ──
    const writeOrder = (number: string) =>
      db.$transaction(async (tx) => {
        // A guest checkout still makes a customer; details are saved once paid.
        const customerId = await attachCustomer(tx, { email })

        const created = await tx.order.create({
          data: {
            number,
            paymentMethod: method,
            // A signed-in staff id wins, so an admin ordering for someone owns it.
            userId: session?.user?.id ?? customerId,
            // COD has no payment to wait for.
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

        // Atomic claim per line so a concurrent order cannot oversell.
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

        // The real, conditional claim; the check above is only the early answer.
        if (couponId && !(await claimCouponUse(tx, couponId))) {
          throw new ConflictError(`${COUPON_UNUSABLE} Remove it and try again.`)
        }

        return created
      })

    // Order numbers can collide (4 random chars); only a duplicate number retries.
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
    // The order has committed, so a gateway failure is compensated by releaseOrder.
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

    // The one moment we know this browser owns this order.
    await rememberOrder(order.number)

    // Best effort: swallows its own failures.
    await attachOrderToVisitor({
      orderId: order.id,
      email: input.email,
      phone: input.phone,
      name: `${input.address.firstName} ${input.address.lastName}`.trim(),
    })

    // An online order's receipt waits for its capture. COD is real now, so what
    // a capture does is done here.
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
 * Records a captured payment and marks its order paid, for /verify, the webhook
 * and the stale-order check alike. The order comes from the payment row, never
 * from the caller. Idempotent: the first flip of the payment row does the work.
 * A cancelled order is revived; its stock may go negative and its coupon use is
 * counted even past the limit (audited), because the customer has paid.
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

    // Only once paid are the order's details saved onto its customer.
    await rememberCustomerDetails(payment.orderId)

    // After the response, so a slow mail server cannot hold up the confirmation.
    const mail = renderOrderConfirmed({
      number: order.number,
      email: order.email,
      total: order.total.toString(),
      // Money came through the gateway, so never the COD wording.
      paymentMethod: order.paymentMethod === "PARTIAL" ? "PARTIAL" : "ONLINE",
      dueOnDelivery: order.paymentMethod === "PARTIAL" ? order.dueOnDelivery.toString() : "0",
      items: order.items.map((i) => ({ name: i.nameSnapshot, qty: i.qty })),
    })
    const to = order.email
    later(async () => {
      await sendMail({ to, ...mail })
    })

    // Best effort: booking sends it if this does not.
    queueShiprocketOrder(payment.orderId)
  } else if (outcome.kind === "untouched") {
    // Captured against an order in a state nothing should move (e.g. refunded). Loud on purpose.
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
 * Reads back a signed payment and captures it if only `authorized`: a valid
 * signature does not prove the money moved. "unreachable" falls back to the
 * signature alone (audited by the caller).
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
 * Called by the browser after Razorpay's handler fires, so the customer sees
 * confirmation at once; the webhook is the source of truth. `orderId` in the
 * body decides nothing.
 */
export async function confirmPayment(
  raw: unknown,
): Promise<ActionResult<{ orderNumber: string; status: string }>> {
  return runAction(async () => {
    const input = verifyPaymentSchema.parse(raw)
    if (!hasDatabase()) return fail("Checkout is not available yet.", undefined, 503)

    // Verified with the account the payment was opened on, not the current one.
    const opened = await db.payment.findUnique({
      where: {
        gateway_gatewayOrderId: { gateway: "razorpay", gatewayOrderId: input.gatewayOrderId },
      },
      select: { mode: true, orderId: true },
    })
    const mode = modeOfPayment(opened?.mode, await paymentConfig())

    if (!(await verifyPaymentSignature(input, mode))) {
      // No caller-sent ids: they would let anyone forge any order's audit trail.
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
      // Conditional on CREATED: Razorpay may deliver a declined attempt's
      // failure after a later attempt's capture, which must not be overwritten.
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
  /** SKU and price too, for the ad pixel's Purchase: Meta matches products by SKU. */
  items: { name: string; qty: number; sku: string; unitPrice: string }[]
}

/**
 * The order behind the confirmation screen, for the browser that placed it or
 * its signed-in owner. Every miss is the same 404, so numbers cannot be probed.
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
        items: {
          select: {
            nameSnapshot: true,
            qty: true,
            unitPrice: true,
            variant: { select: { sku: true } },
          },
        },
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
      items: order.items.map((i) => ({
        name: i.nameSnapshot,
        qty: i.qty,
        sku: i.variant.sku,
        unitPrice: i.unitPrice.toString(),
      })),
    })
  })
}
