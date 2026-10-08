import "server-only"

import { timingSafeEqual } from "node:crypto"
import type { Session } from "next-auth"

import { shippingConfig } from "@/config/shipping"
import { queueInvoiceEmail } from "@/features/invoices/server/invoice.service"
import { renderOrderShipped } from "@/features/orders/emails/order-shipped"
import { bookShipmentSchema, pincodeSchema } from "@/features/shipping/schemas/shipping.schema"
import * as shiprocket from "@/features/shipping/server/shiprocket"
import { ShippingError } from "@/features/shipping/server/shiprocket"
import {
  buildAdhocOrder,
  collectingCouriers,
  courierOptions,
  deliveryEstimate,
  parcelFor,
  shipmentCost,
  shippingFeeFor,
  trackingSnapshot,
  trackingStage,
  trackingUrl,
  webhookEvent,
  type CourierOption,
  type ShippableOrder,
  type TrackingEvent,
} from "@/features/shipping/server/shiprocket-mapping"
import { shippingCharge, shiprocketConfig } from "@/features/settings/server/runtime-settings"
import { PERMISSIONS } from "@/lib/constants"
import { hasDatabase } from "@/lib/env"
import { later } from "@/server/later"
import { AppError } from "@/lib/errors"
import { sendMail } from "@/lib/mailer"
import { createAuditLog, getAuditMeta } from "@/server/audit"
import { fail, ok, runAction, type ActionResult } from "@/server/action-result"
import { requirePermission } from "@/server/action-guard"
import { db } from "@/server/db"

// Shiprocket flow: a paid or COD order is sent in the background (queueShiprocketOrder), staff
// book the courier (bookShipment), and the webhook or "Refresh tracking" moves it to DELIVERED or
// RETURNED. Without a Shiprocket login none of this runs: courier and AWB are typed by hand.

const NOT_SET_UP =
  "Shiprocket is not set up. Add its login in Settings > Shiprocket, or enter the courier and AWB by hand."

const SHIPMENT_SELECT = {
  id: true,
  orderId: true,
  provider: true,
  courier: true,
  awb: true,
  status: true,
  statusAt: true,
  labelUrl: true,
  manifestUrl: true,
  pickupScheduledAt: true,
} as const

const message = (err: unknown) => (err instanceof Error ? err.message : String(err))

// ── getting an order into Shiprocket ───────────────────────────────────────

async function loadShippable(orderId: string) {
  return db.order.findUnique({
    where: { id: orderId },
    select: {
      number: true,
      placedAt: true,
      createdAt: true,
      email: true,
      phone: true,
      paymentMethod: true,
      shippingAddress: true,
      subtotal: true,
      discount: true,
      shipping: true,
      paymentFee: true,
      total: true,
      dueOnDelivery: true,
      shiprocketOrderId: true,
      shiprocketShipmentId: true,
      items: {
        select: {
          qty: true,
          unitPrice: true,
          nameSnapshot: true,
          variant: { select: { sku: true, weightGrams: true } },
        },
      },
    },
  })
}

type LoadedOrder = NonNullable<Awaited<ReturnType<typeof loadShippable>>>

function toShippable(order: LoadedOrder): ShippableOrder {
  const a = (order.shippingAddress ?? {}) as Record<string, unknown>
  const str = (k: string) => (typeof a[k] === "string" ? (a[k] as string) : "")
  return {
    number: order.number,
    placedAt: order.placedAt ?? order.createdAt,
    email: order.email,
    phone: order.phone,
    paymentMethod: order.paymentMethod,
    address: {
      firstName: str("firstName"),
      lastName: str("lastName"),
      line1: str("line1"),
      line2: str("line2"),
      city: str("city"),
      state: str("state"),
      pincode: str("pincode"),
    },
    subtotal: Number(order.subtotal),
    discount: Number(order.discount),
    shipping: Number(order.shipping),
    paymentFee: Number(order.paymentFee),
    total: Number(order.total),
    dueOnDelivery: Number(order.dueOnDelivery),
    items: order.items.map((i) => ({
      name: i.nameSnapshot,
      sku: i.variant.sku,
      qty: i.qty,
      unitPrice: Number(i.unitPrice),
      weightGrams: i.variant.weightGrams,
    })),
  }
}

/**
 * Shiprocket's ids for an order, creating the Shiprocket order if needed. Safe to call twice at
 * once: Shiprocket refuses a duplicate order number, and ids are only written where none exist.
 */
async function ensureShiprocketOrder(
  orderId: string,
): Promise<{ orderId: string; shipmentId: string }> {
  const order = await loadShippable(orderId)
  if (!order) throw new AppError("Order not found.", 404, "NOT_FOUND")
  if (order.shiprocketOrderId && order.shiprocketShipmentId) {
    return { orderId: order.shiprocketOrderId, shipmentId: order.shiprocketShipmentId }
  }

  // create/adhoc matches the pickup name exactly as Shiprocket spells it.
  const pickup = await shiprocket.pickupAddress()
  if (!pickup) {
    throw new ShippingError(
      "No pickup address is set. Add one in Shiprocket (Settings > Pickup Addresses) and put its name in the console's Settings > Shiprocket.",
      503,
    )
  }

  try {
    const created = await shiprocket.createOrder(buildAdhocOrder(toShippable(order), pickup.name))
    await db.order.updateMany({
      where: { id: orderId, shiprocketOrderId: null },
      data: { shiprocketOrderId: created.orderId, shiprocketShipmentId: created.shipmentId },
    })
  } catch (err) {
    // Lost a race to another caller: use theirs.
    const saved = await db.order.findUnique({
      where: { id: orderId },
      select: { shiprocketOrderId: true, shiprocketShipmentId: true },
    })
    if (saved?.shiprocketOrderId && saved.shiprocketShipmentId) {
      return { orderId: saved.shiprocketOrderId, shipmentId: saved.shiprocketShipmentId }
    }
    throw err
  }

  const saved = await db.order.findUnique({
    where: { id: orderId },
    select: { shiprocketOrderId: true, shiprocketShipmentId: true },
  })
  if (!saved?.shiprocketOrderId || !saved.shiprocketShipmentId) {
    throw new ShippingError(
      "The order was sent to Shiprocket but its ids were not saved. Try again.",
    )
  }
  return { orderId: saved.shiprocketOrderId, shipmentId: saved.shiprocketShipmentId }
}

// Rates are quoted from the Shiprocket pickup; the site's pincode stands in until one is set.
async function pickupPincode(): Promise<string> {
  return (await shiprocket.pickupAddress())?.pincode ?? shippingConfig.pickupPincode
}

/**
 * Sends a paid order to Shiprocket after the response. Never delays or fails the payment: on
 * failure the order is sent when staff book the courier.
 */
export function queueShiprocketOrder(orderId: string): void {
  later(async () => {
    if (!(await shiprocket.isShiprocketConfigured()) || !(await shiprocket.pickupLocation())) {
      return
    }
    try {
      const ids = await ensureShiprocketOrder(orderId)
      await createAuditLog(null, {
        action: "shipping:order-created",
        module: "order",
        entityId: orderId,
        meta: { shiprocketOrderId: ids.orderId, shiprocketShipmentId: ids.shipmentId },
      })
    } catch (err) {
      console.error("[SHIPPING] could not send the order to Shiprocket", orderId, err)
      await createAuditLog(null, {
        action: "shipping:order-create-failed",
        module: "order",
        entityId: orderId,
        meta: { error: message(err) },
      })
    }
  })
}

// ── the console ────────────────────────────────────────────────────────────

/** Couriers that deliver this order, with Shiprocket's pick marked. */
export async function getCourierOptions(
  id: string,
): Promise<ActionResult<{ options: CourierOption[]; recommendedId: number | null }>> {
  return runAction(async () => {
    await requirePermission(PERMISSIONS.ORDER_FULFIL)
    if (!hasDatabase()) return fail("Database not configured.", undefined, 503)
    if (!(await shiprocket.isShiprocketConfigured())) return fail(NOT_SET_UP, undefined, 503)

    const order = await loadShippable(id)
    if (!order) return fail("Order not found.", undefined, 404)

    const shippable = toShippable(order)
    const parcel = parcelFor(shippable.items)
    const summary = courierOptions(
      await shiprocket.serviceability({
        pickup_postcode: await pickupPincode(),
        delivery_postcode: shippable.address.pincode,
        cod: order.paymentMethod === "ONLINE" ? 0 : 1,
        weight: parcel.weightKg,
        length: parcel.lengthCm,
        breadth: parcel.breadthCm,
        height: parcel.heightCm,
        declared_value: Math.round(Number(order.total)),
      }),
    )
    if (summary.options.length === 0) {
      return fail("No courier on Shiprocket delivers to this pincode right now.", undefined, 422)
    }
    return ok(summary)
  })
}

export type BookedShipment = {
  id: string
  status: "SHIPPED"
  courier: string
  awb: string
  labelUrl: string | null
  manifestUrl: string | null
}

/**
 * Books the courier for a packed order: AWB, pickup, manifest, label. The AWB charges the wallet,
 * so it is saved at once and never asked for twice; each step skips what is done, so booking again
 * resumes. SHIPPED once the pickup is scheduled; a SHIPPED order may come back for its label.
 */
export async function bookShipment(
  id: string,
  raw: unknown,
): Promise<ActionResult<BookedShipment>> {
  return runAction(async () => {
    const session = await requirePermission(PERMISSIONS.ORDER_FULFIL)
    if (!hasDatabase()) return fail("Database not configured.", undefined, 503)
    if (!(await shiprocket.isShiprocketConfigured())) return fail(NOT_SET_UP, undefined, 503)
    const input = bookShipmentSchema.parse(raw ?? {})

    const order = await db.order.findUnique({
      where: { id },
      select: { status: true, shipment: { select: SHIPMENT_SELECT } },
    })
    if (!order) return fail("Order not found.", undefined, 404)

    let shipment = order.shipment
    const finishing = order.status === "SHIPPED" && shipment?.provider === "shiprocket"
    if (order.status !== "PACKED" && !finishing) {
      return fail("Only a packed order can be booked with a courier.", undefined, 409)
    }
    if (shipment?.awb && shipment.provider !== "shiprocket") {
      return fail("This order already has a courier and AWB entered by hand.", undefined, 409)
    }

    const ids = await ensureShiprocketOrder(id)

    if (!shipment?.awb) {
      const assigned = await shiprocket.assignAwb(ids.shipmentId, input.courierId)
      const data = {
        provider: "shiprocket",
        courier: assigned.courierName,
        awb: assigned.awb,
        status: "AWB ASSIGNED",
        statusAt: new Date(),
      }
      shipment = await db.shipment.upsert({
        where: { orderId: id },
        create: { orderId: id, ...data },
        update: data,
        select: SHIPMENT_SELECT,
      })
      await createAuditLog(session, {
        action: "shipping:awb",
        module: "order",
        entityId: id,
        meta: {
          awb: assigned.awb,
          courier: assigned.courierName,
          courierId: input.courierId ?? null,
        },
        ...(await getAuditMeta()),
      })
    }

    const problems: string[] = []

    if (!shipment.pickupScheduledAt) {
      try {
        const pickup = await shiprocket.requestPickup(ids.shipmentId)
        shipment = await db.shipment.update({
          where: { orderId: id },
          data: {
            pickupScheduledAt: pickup.scheduledAt ?? new Date(),
            status: "PICKUP SCHEDULED",
            statusAt: new Date(),
          },
          select: SHIPMENT_SELECT,
        })
      } catch (err) {
        problems.push(`the pickup request failed (${message(err)})`)
      }
    }

    // Shiprocket wants the manifest after the pickup. The panel can reprint it: only log a failure.
    if (shipment.pickupScheduledAt && !shipment.manifestUrl) {
      try {
        const url = await shiprocket.generateManifest(ids.shipmentId)
        if (url) {
          shipment = await db.shipment.update({
            where: { orderId: id },
            data: { manifestUrl: url },
            select: SHIPMENT_SELECT,
          })
        }
      } catch (err) {
        console.warn("[SHIPPING] manifest not generated", id, message(err))
      }
    }

    if (!shipment.labelUrl) {
      try {
        const url = await shiprocket.generateLabel(ids.shipmentId)
        shipment = await db.shipment.update({
          where: { orderId: id },
          data: { labelUrl: url },
          select: SHIPMENT_SELECT,
        })
      } catch (err) {
        problems.push(`the label could not be made (${message(err)})`)
      }
    }

    const awb = shipment.awb ?? ""
    if (!shipment.pickupScheduledAt) {
      return fail(
        `${shipment.courier} is booked with AWB ${awb}, but ${problems.join(" and ")}. Book again to retry - the AWB is kept.`,
        undefined,
        502,
      )
    }

    const claimed = await db.order.updateMany({
      where: { id, status: "PACKED" },
      data: { status: "SHIPPED" },
    })
    if (claimed.count > 0) {
      await db.shipment.update({ where: { orderId: id }, data: { shippedAt: new Date() } })
      await createAuditLog(session, {
        action: "order:ship",
        module: "order",
        entityId: id,
        meta: { to: "SHIPPED", provider: "shiprocket", courier: shipment.courier, awb },
        ...(await getAuditMeta()),
      })
      notifyShipped(id)
    }

    return ok({
      id,
      status: "SHIPPED",
      courier: shipment.courier,
      awb,
      labelUrl: shipment.labelUrl,
      manifestUrl: shipment.manifestUrl,
    })
  })
}

/** Pulls the latest tracking from Shiprocket, for when a webhook was missed. */
export async function refreshTracking(
  id: string,
): Promise<ActionResult<{ status: string | null; changed: boolean }>> {
  return runAction(async () => {
    const session = await requirePermission(PERMISSIONS.ORDER_FULFIL)
    if (!hasDatabase()) return fail("Database not configured.", undefined, 503)
    if (!(await shiprocket.isShiprocketConfigured())) return fail(NOT_SET_UP, undefined, 503)

    const shipment = await db.shipment.findUnique({
      where: { orderId: id },
      select: { awb: true, provider: true, status: true },
    })
    if (!shipment?.awb || shipment.provider !== "shiprocket") {
      return fail("This order has no Shiprocket shipment to track.", undefined, 409)
    }

    const event = trackingSnapshot(await shiprocket.trackAwb(shipment.awb), shipment.awb)
    if (!event) return ok({ status: shipment.status, changed: false })

    await applyTrackingEvent(event, "refresh", session)
    return ok({ status: event.status, changed: event.status !== shipment.status })
  })
}

// ── tracking updates ───────────────────────────────────────────────────────

/**
 * Applies one tracking update. Older updates do not overwrite the shipment (Shiprocket can send
 * them out of order), and the order only moves forward, so a replay cannot drag it back.
 */
async function applyTrackingEvent(
  event: TrackingEvent,
  source: "webhook" | "refresh",
  session: Session | null = null,
): Promise<boolean> {
  let shipment = event.awb
    ? await db.shipment.findFirst({ where: { awb: event.awb }, select: SHIPMENT_SELECT })
    : null

  // Booked from the Shiprocket panel rather than the console: adopt it.
  if (!shipment && event.shiprocketOrderId && event.awb) {
    const order = await db.order.findUnique({
      where: { shiprocketOrderId: event.shiprocketOrderId },
      select: { id: true },
    })
    if (order) {
      const data = {
        provider: "shiprocket",
        courier: event.courier ?? "Courier",
        awb: event.awb,
        status: event.status,
        statusAt: event.at ?? new Date(),
      }
      shipment = await db.shipment.upsert({
        where: { orderId: order.id },
        create: { orderId: order.id, ...data },
        update: data,
        select: SHIPMENT_SELECT,
      })
    }
  }
  if (!shipment) return false

  const stale = event.at && shipment.statusAt && event.at < shipment.statusAt
  if (!stale) {
    await db.shipment.update({
      where: { id: shipment.id },
      data: {
        status: event.status.slice(0, 80),
        statusAt: event.at ?? new Date(),
        ...(event.etd ? { etd: event.etd } : {}),
        ...(event.courier ? { courier: event.courier } : {}),
      },
    })
  }

  const orderId = shipment.orderId
  const at = event.at ?? new Date()
  const audit = (action: string, to: string) =>
    createAuditLog(session, {
      action,
      module: "order",
      entityId: orderId,
      meta: { to, source, status: event.status, awb: event.awb },
    })

  switch (trackingStage(event.status)) {
    case "in_transit": {
      const moved = await db.order.updateMany({
        where: { id: orderId, status: { in: ["CONFIRMED", "PAID", "PACKED"] } },
        data: { status: "SHIPPED" },
      })
      if (moved.count > 0) {
        await db.shipment.update({ where: { id: shipment.id }, data: { shippedAt: at } })
        await audit("order:ship", "SHIPPED")
        notifyShipped(orderId)
      }
      break
    }
    case "delivered": {
      const moved = await db.order.updateMany({
        where: { id: orderId, status: { in: ["CONFIRMED", "PAID", "PACKED", "SHIPPED"] } },
        data: { status: "DELIVERED" },
      })
      if (moved.count > 0) {
        await db.shipment.update({ where: { id: shipment.id }, data: { deliveredAt: at } })
        // Cash on delivery becomes revenue at the door, as in markDelivered.
        await db.order.updateMany({
          where: { id: orderId, paymentMethod: "COD", placedAt: null },
          data: { placedAt: at },
        })
        await audit("order:deliver", "DELIVERED")
        queueInvoiceEmail(orderId)
      }
      break
    }
    case "returned": {
      const moved = await db.order.updateMany({
        where: { id: orderId, status: "SHIPPED" },
        data: { status: "RETURNED" },
      })
      if (moved.count > 0) await audit("order:returned", "RETURNED")
      break
    }
    default:
      // Recorded above; anything else is left to a person.
      break
  }
  return true
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

/**
 * Shiprocket's tracking webhook. Always answers 200: their spec requires it, and an erroring
 * webhook can be switched off at their end. Updates without the shared token are ignored.
 */
export async function applyShippingWebhook(
  token: string | null,
  rawBody: string,
): Promise<ActionResult<{ handled: boolean }>> {
  const expected = (await shiprocketConfig()).webhookToken
  if (!expected || !token || !safeEqual(token, expected)) {
    console.warn("[SHIPPING] tracking webhook without a valid token ignored")
    return ok({ handled: false })
  }
  if (!hasDatabase()) return ok({ handled: false })

  try {
    const event = webhookEvent(JSON.parse(rawBody) as unknown)
    if (!event) return ok({ handled: false })
    return ok({ handled: await applyTrackingEvent(event, "webhook") })
  } catch (err) {
    console.error("[SHIPPING] tracking webhook could not be applied", err)
    return ok({ handled: false })
  }
}

// ── notifications and cancellation ─────────────────────────────────────────

/** The "it has shipped" email, after the response. Never fails the caller. */
export function notifyShipped(orderId: string): void {
  later(async () => {
    try {
      const order = await db.order.findUnique({
        where: { id: orderId },
        select: {
          number: true,
          email: true,
          dueOnDelivery: true,
          items: { select: { nameSnapshot: true, qty: true } },
          shipment: { select: { courier: true, awb: true, provider: true } },
        },
      })
      if (!order?.shipment) return
      const s = order.shipment
      const mail = renderOrderShipped({
        number: order.number,
        courier: s.courier,
        awb: s.awb,
        trackingUrl: s.provider === "shiprocket" && s.awb ? trackingUrl(s.awb) : null,
        dueOnDelivery: order.dueOnDelivery.toString(),
        items: order.items.map((i) => ({ name: i.nameSnapshot, qty: i.qty })),
      })
      await sendMail({ to: order.email, ...mail })
    } catch (err) {
      console.error("[SHIPPING] shipped email not sent", orderId, err)
    }
  })
}

/**
 * Cancels the AWB and Shiprocket order of an order refunded before it left. Best effort: the
 * refund already happened, so a failure is audited for someone to cancel in the panel.
 */
export async function cancelShiprocketOrder(
  orderId: string,
  session: Session | null,
): Promise<void> {
  if (!(await shiprocket.isShiprocketConfigured())) return
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { shiprocketOrderId: true, shipment: { select: { awb: true, provider: true } } },
  })
  if (!order?.shiprocketOrderId) return

  try {
    if (order.shipment?.provider === "shiprocket" && order.shipment.awb) {
      await shiprocket.cancelShipments([order.shipment.awb])
    }
    await shiprocket.cancelOrders([order.shiprocketOrderId])
    await db.shipment.updateMany({
      where: { orderId, provider: "shiprocket" },
      data: { status: "CANCELLED", statusAt: new Date() },
    })
    await createAuditLog(session, {
      action: "shipping:cancelled",
      module: "order",
      entityId: orderId,
      meta: { shiprocketOrderId: order.shiprocketOrderId },
    })
  } catch (err) {
    console.error("[SHIPPING] could not cancel in Shiprocket", orderId, err)
    await createAuditLog(session, {
      action: "shipping:cancel-failed",
      module: "order",
      entityId: orderId,
      meta: { shiprocketOrderId: order.shiprocketOrderId, error: message(err) },
    })
  }
}

// ── the storefront's pincode check ─────────────────────────────────────────

export type PincodeAnswer = {
  /** False when Shiprocket is not set up or did not answer: show the static promise. */
  live: boolean
  serviceable: boolean
  /** Days in transit, from the courier Shiprocket would book. */
  days: number | null
  /** False only when Shiprocket says there is no such pincode. */
  found: boolean
  /** For filling in the checkout address. */
  city: string | null
  state: string | null
  /**
   * Rupees: 0, or the flat fee when this pincode costs the shop more than the threshold
   * (shippingCharge()). Always 0 when Shiprocket could not be asked.
   */
  shippingFee: number
}

/** A cached answer: everything but the fee, plus the quotes the fee comes from. */
type Reach = { answer: Omit<PincodeAnswer, "shippingFee">; options: CourierOption[] }

const PINCODE_TTL_MS = 6 * 60 * 60_000
// On globalThis, so a Settings save clears it for every route.
const sharedCache = globalThis as unknown as {
  skelmetPincodes?: Map<string, { reach: Reach; expiresAt: number }>
}
const pincodeCache = (sharedCache.skelmetPincodes ??= new Map())

/** Ceiling on cached answers (one per pincode and parcel size); past it the oldest goes. */
export const PINCODE_CACHE_MAX = 5_000

function remember(key: string, reach: Reach, now: number): Reach {
  if (pincodeCache.size >= PINCODE_CACHE_MAX) {
    for (const [k, value] of pincodeCache) if (value.expiresAt <= now) pincodeCache.delete(k)
  }
  // Re-inserted, so insertion order is arrival order.
  pincodeCache.delete(key)
  pincodeCache.set(key, { reach, expiresAt: now + PINCODE_TTL_MS })
  while (pincodeCache.size > PINCODE_CACHE_MAX) {
    const oldest = pincodeCache.keys().next().value
    if (oldest === undefined) break
    pincodeCache.delete(oldest)
  }
  return reach
}

/**
 * Drops cached answers when Settings changes the Shiprocket account or pickup. A new shipping
 * charge needs nothing: the fee is recomputed on every read.
 */
export function forgetPincodeChecks(): void {
  pincodeCache.clear()
  collectCache.clear()
}

/** The fee for a cached or fresh answer, under the shipping charge in force now. */
async function priced(reach: Reach): Promise<PincodeAnswer> {
  const charge = await shippingCharge()
  return {
    ...reach.answer,
    shippingFee: shippingFeeFor(shipmentCost(reach.options, charge.basis), charge),
  }
}

/**
 * Delivery check: serviceable, days, place, and the buyer's shipping fee. Checkout and placeOrder
 * ask with the same unit count, so the fee shown is the fee charged. Cached six hours per pincode
 * and parcel. When Shiprocket is unavailable: `live: false` and free shipping.
 */
export async function checkPincode(raw: unknown): Promise<ActionResult<PincodeAnswer>> {
  return runAction(async () => {
    const { pincode, units } = pincodeSchema.parse(raw)
    const offline: PincodeAnswer = {
      live: false,
      serviceable: true,
      days: null,
      found: true,
      city: null,
      state: null,
      shippingFee: 0,
    }
    const account = await shiprocketConfig()
    if (!account.email || !account.password) return ok(offline)

    // Rates depend on the account and pickup, so both are in the key.
    const key = `${account.email}|${account.pickupLocation ?? ""}|${pincode}:${units}`
    const now = Date.now()
    const hit = pincodeCache.get(key)
    if (hit && hit.expiresAt > now) return ok(await priced(hit.reach))

    // Runs on past the budget, so a slow answer still fills the cache.
    const lookup = askShiprocket(key, pincode, units, now)
    lookup.catch((err: unknown) => console.warn("[SHIPPING] pincode lookup failed", message(err)))

    const answer = await withinBudget(lookup, PINCODE_BUDGET_MS)
    if (answer === "late") {
      console.warn("[SHIPPING] Shiprocket took too long; pincode check fell back")
      return ok(offline)
    }
    if ("reach" in answer) return ok(await priced(answer.reach))
    return ok({ ...offline, city: answer.city, state: answer.state })
  })
}

/** How long the pincode check waits on Shiprocket before giving the offline answer. */
export const PINCODE_BUDGET_MS = 4_000

async function withinBudget<T>(work: Promise<T>, ms: number): Promise<T | "late"> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const late = new Promise<"late">((resolve) => {
    timer = setTimeout(() => resolve("late"), ms)
    timer.unref?.()
  })
  try {
    return await Promise.race([work, late])
  } finally {
    clearTimeout(timer)
  }
}

// Asks Shiprocket and caches the answer. If the rate quote fails, returns only the place.
async function askShiprocket(
  key: string,
  pincode: string,
  units: number,
  now: number,
): Promise<{ reach: Reach } | { city: string | null; state: string | null }> {
  const parcel = parcelFor([{ name: "", sku: "", qty: units, unitPrice: 0, weightGrams: null }])
  const [reach, place] = await Promise.allSettled([
    pickupPincode().then((pickup) =>
      shiprocket.serviceability({
        pickup_postcode: pickup,
        delivery_postcode: pincode,
        cod: 0,
        weight: parcel.weightKg,
        length: parcel.lengthCm,
        breadth: parcel.breadthCm,
        height: parcel.heightCm,
      }),
    ),
    shiprocket.postcodeDetails(pincode),
  ])

  // null: no such pincode. undefined: the lookup failed.
  const where = place.status === "fulfilled" ? place.value : undefined
  if (place.status === "rejected") {
    console.warn("[SHIPPING] postcode lookup failed", message(place.reason))
  }

  // Not a real pincode: cached like any answer.
  if (where === null) {
    const nowhere: Reach = {
      answer: {
        live: true,
        serviceable: false,
        days: null,
        found: false,
        city: null,
        state: null,
      },
      options: [],
    }
    return { reach: remember(key, nowhere, now) }
  }

  if (reach.status === "rejected") {
    console.warn("[SHIPPING] pincode check fell back to the static promise", message(reach.reason))
    return { city: where?.city ?? null, state: where?.state ?? null }
  }

  const { options } = courierOptions(reach.value)
  const best = deliveryEstimate(options)
  const found: Reach = {
    answer: {
      live: true,
      serviceable: options.length > 0,
      days: best?.days ?? null,
      found: true,
      city: where?.city ?? null,
      state: where?.state ?? null,
    },
    options,
  }
  // Not cached without the place, so the next check can fill it in.
  return { reach: where ? remember(key, found, now) : found }
}

// ── paying on delivery ─────────────────────────────────────────────────────

const sharedCollect = globalThis as unknown as {
  skelmetCollects?: Map<string, { collects: boolean; expiresAt: number }>
}
const collectCache = (sharedCollect.skelmetCollects ??= new Map())

/**
 * Whether a courier collects payment at the door here. A separate Shiprocket call, made only when
 * pay on delivery is offered. Null ("not known", so it is offered) when Shiprocket is not set up,
 * failed or was late; booking checks the couriers again. Cached six hours.
 */
export async function collectsOnDelivery(pincode: string, units: number): Promise<boolean | null> {
  const account = await shiprocketConfig()
  if (!account.email || !account.password) return null

  const key = `${account.email}|${account.pickupLocation ?? ""}|${pincode}:${units}`
  const hit = collectCache.get(key)
  if (hit && hit.expiresAt > Date.now()) return hit.collects

  const parcel = parcelFor([{ name: "", sku: "", qty: units, unitPrice: 0, weightGrams: null }])
  // Runs on past the budget, as in checkPincode.
  const lookup = pickupPincode()
    .then((pickup) =>
      shiprocket.serviceability({
        pickup_postcode: pickup,
        delivery_postcode: pincode,
        cod: 1,
        weight: parcel.weightKg,
        length: parcel.lengthCm,
        breadth: parcel.breadthCm,
        height: parcel.heightCm,
      }),
    )
    .then((body) => {
      const collects = collectingCouriers(body) > 0
      if (collectCache.size >= PINCODE_CACHE_MAX) collectCache.clear()
      collectCache.set(key, { collects, expiresAt: Date.now() + PINCODE_TTL_MS })
      return collects
    })
  lookup.catch((err: unknown) =>
    console.warn("[SHIPPING] pay-on-delivery check failed", message(err)),
  )

  try {
    const answer = await withinBudget(lookup, PINCODE_BUDGET_MS)
    return answer === "late" ? null : answer
  } catch {
    return null
  }
}
