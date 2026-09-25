import "server-only"

import { timingSafeEqual } from "node:crypto"
import { after } from "next/server"
import type { Session } from "next-auth"

import { shippingConfig } from "@/config/shipping"
import { renderOrderShipped } from "@/features/orders/emails/order-shipped"
import { bookShipmentSchema, pincodeSchema } from "@/features/shipping/schemas/shipping.schema"
import * as shiprocket from "@/features/shipping/server/shiprocket"
import { ShippingError } from "@/features/shipping/server/shiprocket"
import {
  buildAdhocOrder,
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
import { AppError } from "@/lib/errors"
import { sendMail } from "@/lib/mailer"
import { createAuditLog, getAuditMeta } from "@/server/audit"
import { fail, ok, runAction, type ActionResult } from "@/server/action-result"
import { requirePermission } from "@/server/action-guard"
import { db } from "@/server/db"

/**
 * Shipping through Shiprocket.
 *
 * The flow, and who drives each step:
 *
 *  1. Payment captured      -> the order is sent to Shiprocket in the
 *                              background (queueShiprocketOrder). Best
 *                              effort: if it fails, step 2 sends it.
 *  2. Staff click "Book"    -> bookShipment: courier + AWB, pickup request,
 *                              manifest, label. The order becomes SHIPPED
 *                              once the pickup is scheduled.
 *  3. The courier moves it  -> Shiprocket's webhook (applyShippingWebhook), or
 *                              "Refresh tracking" in the console, updates the
 *                              shipment and moves the order to DELIVERED, or
 *                              RETURNED for an RTO.
 *
 * Booking is resumable. Each step records what it achieved before the next
 * one runs, so a pickup request that fails after the AWB was assigned keeps
 * the AWB, and booking again carries on from the pickup instead of asking
 * Shiprocket for a second courier.
 *
 * A courier booked in the Shiprocket panel instead of the console still
 * reaches the order: its first tracking update names the Shiprocket order,
 * and the shipment is adopted from there.
 *
 * Without a Shiprocket login - in the console's Settings, or SHIPROCKET_* in
 * .env - none of this runs: the console keeps the hand-typed courier and AWB,
 * and the pincode check keeps its static promise.
 */

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
      total: true,
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
 * Shiprocket's ids for an order, creating the Shiprocket order if it does not
 * have one yet. Safe to call twice at once: Shiprocket refuses a second order
 * with the same number, and the ids are only written where none exist.
 */
async function ensureShiprocketOrder(
  orderId: string,
): Promise<{ orderId: string; shipmentId: string }> {
  const order = await loadShippable(orderId)
  if (!order) throw new AppError("Order not found.", 404, "NOT_FOUND")
  if (order.shiprocketOrderId && order.shiprocketShipmentId) {
    return { orderId: order.shiprocketOrderId, shipmentId: order.shiprocketShipmentId }
  }

  // Shiprocket's own spelling of the name, which is what create/adhoc matches on.
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
    // Lost a race to another caller that created it a moment ago: use theirs.
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

/**
 * Where rates are quoted from: the Shiprocket pickup address's own pincode,
 * since that is where the courier collects. The site's office pincode only
 * stands in until a pickup location is configured.
 */
async function pickupPincode(): Promise<string> {
  return (await shiprocket.pickupAddress())?.pincode ?? shippingConfig.pickupPincode
}

/**
 * Runs `task` once the response has gone out. Outside a request - a script,
 * a test - `after` throws, and the task simply runs now instead.
 */
function later(task: () => Promise<void>): void {
  try {
    after(task)
  } catch {
    void task()
  }
}

/**
 * Sends a freshly paid order to Shiprocket, after the response. Never delays
 * or fails the payment: a Shiprocket outage just means the order is sent when
 * staff book the courier instead.
 */
export function queueShiprocketOrder(orderId: string): void {
  later(async () => {
    // Checked in here, after the response: the settings read is async, and
    // nothing about it should hold up the payment.
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
        cod: order.paymentMethod === "COD" ? 1 : 0,
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
 * Books the courier for a packed order: AWB, pickup, manifest, label.
 *
 * The AWB is what charges the wallet, so it is asked for once: it is saved the
 * moment it arrives, and every later step checks what is already done before
 * doing it. The order becomes SHIPPED when the pickup is scheduled - the label
 * matters, but a missing one is only a reprint, so a SHIPPED order can come
 * back here to fetch it.
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

    // Shiprocket asks for the manifest after the pickup. It is paperwork the
    // panel can reprint, so a failure here is logged, not surfaced.
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
 * Applies one tracking update, from the webhook or a refresh.
 *
 * The shipment row always takes the courier's latest words, unless the update
 * is older than what is already recorded - Shiprocket can deliver them out of
 * order. The order itself only ever moves forward, through claims on the
 * statuses it may leave, so a replayed or late update cannot drag it back.
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
        where: { id: orderId, status: { in: ["PAID", "PACKED"] } },
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
        where: { id: orderId, status: { in: ["PAID", "PACKED", "SHIPPED"] } },
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
      // Booked, on its way back, cancelled, unknown: recorded above, and
      // left to a person to act on.
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
 * Shiprocket's tracking webhook.
 *
 * Always answers ok: Shiprocket's spec says the URL must only ever return 200,
 * and a webhook that errors can be switched off at their end. So a failure is
 * logged, and the update it carried can be pulled back later with "Refresh
 * tracking". What is NOT accepted is an update without the shared token - it
 * is ignored, and with no token configured at all, every update is.
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
        items: order.items.map((i) => ({ name: i.nameSnapshot, qty: i.qty })),
      })
      await sendMail({ to: order.email, ...mail })
    } catch (err) {
      console.error("[SHIPPING] shipped email not sent", orderId, err)
    }
  })
}

/**
 * Calls off the Shiprocket side of an order that is being refunded before it
 * left: the AWB, so the courier does not come, and the order itself. Best
 * effort - the refund has already happened, and a failure here is audited so
 * someone can cancel it in the panel.
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
  /** Days in transit once handed over, from the courier Shiprocket would book. */
  days: number | null
  /** False only when Shiprocket says there is no such pincode. */
  found: boolean
  /** Where the pincode is, for filling in the checkout address. Null when not known. */
  city: string | null
  state: string | null
  /**
   * What the buyer pays for shipping, rupees: 0, or the shipping charge's flat
   * fee when reaching this pincode costs the shop more than its threshold (see
   * shippingCharge()). Always 0 when Shiprocket could not be asked.
   */
  shippingFee: number
}

/** An answer as cached: everything but the fee, and the quotes the fee comes from. */
type Reach = { answer: Omit<PincodeAnswer, "shippingFee">; options: CourierOption[] }

const PINCODE_TTL_MS = 6 * 60 * 60_000
// On globalThis, so a save in Settings clears it for every route (as the
// Shiprocket session in shiprocket.ts).
const sharedCache = globalThis as unknown as {
  skelmetPincodes?: Map<string, { reach: Reach; expiresAt: number }>
}
const pincodeCache = (sharedCache.skelmetPincodes ??= new Map())

function remember(key: string, reach: Reach, now: number): Reach {
  if (pincodeCache.size > 5_000) {
    for (const [k, value] of pincodeCache) if (value.expiresAt <= now) pincodeCache.delete(k)
  }
  pincodeCache.set(key, { reach, expiresAt: now + PINCODE_TTL_MS })
  return reach
}

/**
 * Drops every cached pincode answer - for when Settings changes the
 * Shiprocket account or pickup address, which change the couriers and their
 * rates. A new shipping charge needs nothing: the fee is worked out afresh on
 * every read, from the cached quotes.
 */
export function forgetPincodeChecks(): void {
  pincodeCache.clear()
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
 * Can we deliver here, how long does the courier take, where is it, and what
 * does the buyer pay for shipping.
 *
 * The product page asks for one mount; checkout asks for the order's own
 * parcel, since couriers price by the box and more mounts stack into a bigger
 * one. placeOrder asks again with the same count, so the fee checkout showed
 * is the fee charged - both from this one function, and usually from its
 * cache. The two Shiprocket calls go out together and fail independently, so
 * a pincode with no courier still fills the address, and one Shiprocket
 * cannot place still gets its couriers.
 *
 * Cached per pincode and parcel for six hours: serviceability and rates change
 * slowly, and the product page should not spend a Shiprocket call on every
 * CHECK. When Shiprocket is unavailable the answer is `live: false`, shipping
 * is free, and the page falls back to the promise it made before this existed.
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

    // Rates depend on the account and where it collects from, so an answer
    // from before either changed is never reused.
    const key = `${account.email}|${account.pickupLocation ?? ""}|${pincode}:${units}`
    const now = Date.now()
    const hit = pincodeCache.get(key)
    if (hit && hit.expiresAt > now) return ok(await priced(hit.reach))

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

    // null: Shiprocket has no such pincode. undefined: the lookup itself failed.
    const where = place.status === "fulfilled" ? place.value : undefined
    if (place.status === "rejected") {
      console.warn("[SHIPPING] postcode lookup failed", message(place.reason))
    }

    // Not a real pincode. That does not change, so it is remembered like any answer.
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
      return ok(await priced(remember(key, nowhere, now)))
    }

    if (reach.status === "rejected") {
      console.warn(
        "[SHIPPING] pincode check fell back to the static promise",
        message(reach.reason),
      )
      return ok({ ...offline, city: where?.city ?? null, state: where?.state ?? null })
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
    // Without the place, not remembered: the next check can still fill it in.
    return ok(await priced(where ? remember(key, found, now) : found))
  })
}
