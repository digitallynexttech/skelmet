import { shippingConfig, type FeeBasis } from "@/config/shipping"

/**
 * Translation between our orders and Shiprocket's API, as pure functions.
 *
 * Nothing here talks to the network or the database, so every rule about what
 * Shiprocket is sent, and how its answers are read, is covered by
 * shiprocket-mapping.test.ts. The calls themselves live in shiprocket.ts, and
 * what the shop does with the answers in shipping.service.ts.
 *
 * Shaped from Shiprocket's published API collection (apidocs.shiprocket.in).
 * Their numbers arrive as numbers or strings depending on the endpoint, and
 * their dates in three formats, all Indian time - so every read is defensive.
 */

// ── the order, as the mapping needs it ─────────────────────────────────────

export type ShippableOrder = {
  number: string
  placedAt: Date
  email: string
  phone: string
  paymentMethod: "ONLINE" | "COD"
  address: {
    firstName: string
    lastName: string
    line1: string
    line2?: string
    city: string
    state: string
    pincode: string
  }
  subtotal: number
  discount: number
  shipping: number
  items: Array<{
    name: string
    sku: string
    qty: number
    unitPrice: number
    /** Packed weight of one unit, when the variant has one. */
    weightGrams: number | null
  }>
}

export type Parcel = { weightKg: number; lengthCm: number; breadthCm: number; heightCm: number }

const IST_OFFSET_MS = 330 * 60_000

const round = (value: number, places: number) => {
  const f = 10 ** places
  return Math.round(value * f) / f
}

/**
 * The bare ten-digit mobile. Checkout accepts "+91 98765 43210" and friends;
 * Shiprocket wants 9876543210.
 */
export function bareMobile(phone: string): string {
  return phone.replace(/\D/g, "").slice(-10)
}

/** "YYYY-MM-DD HH:mm" on the Indian clock, which is the only one Shiprocket reads. */
export function istStamp(at: Date): string {
  const ist = new Date(at.getTime() + IST_OFFSET_MS)
  const p = (n: number) => String(n).padStart(2, "0")
  return `${ist.getUTCFullYear()}-${p(ist.getUTCMonth() + 1)}-${p(ist.getUTCDate())} ${p(ist.getUTCHours())}:${p(ist.getUTCMinutes())}`
}

/**
 * The parcel for a set of lines. Weight is per unit, from the variant when it
 * has one; more than one unit stacks on the box's height, which is how two
 * mounts actually go into one carton.
 */
export function parcelFor(items: ShippableOrder["items"]): Parcel {
  const units = items.reduce((n, i) => n + i.qty, 0)
  const grams = items.reduce(
    (sum, i) => sum + i.qty * (i.weightGrams ?? shippingConfig.defaultPackedWeightGrams),
    0,
  )
  const { lengthCm, breadthCm, heightCm } = shippingConfig.box
  return {
    // Shiprocket rejects a weight of 0.
    weightKg: Math.max(0.1, round(grams / 1000, 3)),
    lengthCm,
    breadthCm,
    heightCm: heightCm * Math.max(1, units),
  }
}

/**
 * POST /orders/create/adhoc.
 *
 * `order_id` is our order number, so staff can find the order in the
 * Shiprocket panel by the number the customer quotes - and because Shiprocket
 * refuses a second order with the same id, a retry can never create a
 * duplicate shipment.
 *
 * `sub_total` is "after deductions" in Shiprocket's words, and they do not
 * compute totals themselves, so it is what the lines cost after the coupon.
 */
export function buildAdhocOrder(order: ShippableOrder, pickupLocation: string) {
  const parcel = parcelFor(order.items)
  const a = order.address
  return {
    order_id: order.number,
    order_date: istStamp(order.placedAt),
    pickup_location: pickupLocation,
    billing_customer_name: a.firstName,
    billing_last_name: a.lastName,
    billing_address: a.line1,
    billing_address_2: a.line2 ?? "",
    // Shiprocket caps the city at 30 characters.
    billing_city: a.city.slice(0, 30),
    billing_pincode: Number(a.pincode),
    billing_state: a.state,
    billing_country: "India",
    billing_email: order.email,
    billing_phone: Number(bareMobile(order.phone)),
    shipping_is_billing: true,
    order_items: order.items.map((i) => ({
      name: i.name,
      sku: i.sku,
      units: i.qty,
      selling_price: i.unitPrice,
    })),
    payment_method: order.paymentMethod === "COD" ? "COD" : "Prepaid",
    shipping_charges: order.shipping,
    total_discount: order.discount,
    sub_total: round(order.subtotal - order.discount, 2),
    length: parcel.lengthCm,
    breadth: parcel.breadthCm,
    height: parcel.heightCm,
    weight: parcel.weightKg,
  }
}

// ── dates ──────────────────────────────────────────────────────────────────

const MONTHS: Record<string, number> = {
  JAN: 0,
  FEB: 1,
  MAR: 2,
  APR: 3,
  MAY: 4,
  JUN: 5,
  JUL: 6,
  AUG: 7,
  SEP: 8,
  OCT: 9,
  NOV: 10,
  DEC: 11,
}

function fromIst(y: number, mo: number, d: number, h = 0, mi = 0, s = 0): Date | null {
  if (!Number.isInteger(mo) || mo < 0 || mo > 11) return null
  const out = new Date(Date.UTC(y, mo, d, h, mi, s) - IST_OFFSET_MS)
  return Number.isNaN(out.getTime()) ? null : out
}

/**
 * Reads the three date formats Shiprocket uses, all on Indian time:
 *
 *   "2023-05-23 15:40:19"  most timestamps
 *   "23 05 2023 11:43:52"  a webhook's current_timestamp
 *   "Sep 27, 2026"         a serviceability etd
 *
 * Anything else - including their "NA" - is null, never a guess.
 */
export function parseShiprocketDate(value: unknown): Date | null {
  if (typeof value !== "string") return null
  const s = value.trim()

  let m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(s)
  if (m) return fromIst(+m[1]!, +m[2]! - 1, +m[3]!, +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0))

  m = /^(\d{2}) (\d{2}) (\d{4})(?: (\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(s)
  if (m) return fromIst(+m[3]!, +m[2]! - 1, +m[1]!, +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0))

  m = /^([A-Za-z]{3})[a-z]* (\d{1,2}), (\d{4})$/.exec(s)
  if (m) return fromIst(+m[3]!, MONTHS[m[1]!.toUpperCase()] ?? -1, +m[2]!)

  return null
}

// ── tracking ───────────────────────────────────────────────────────────────

/**
 * Where a shipment is, reduced to what the shop acts on.
 *
 *   booked      AWB, pickup, manifest - still with us
 *   in_transit  the courier has it
 *   delivered   done
 *   returning   RTO: coming back to us
 *   returned    RTO delivered: back on our shelf
 *   cancelled   the shipment was called off
 *   unknown     anything else - recorded, never acted on
 *
 * Read from the status text rather than Shiprocket's numeric ids, which their
 * documentation does not list. The order of the checks matters: "RTO
 * DELIVERED" and "UNDELIVERED" both contain "DELIVERED".
 */
export type TrackingStage =
  "booked" | "in_transit" | "delivered" | "returning" | "returned" | "cancelled" | "unknown"

export function normaliseStatus(label: string): string {
  return label.trim().toUpperCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ")
}

export function trackingStage(label: string): TrackingStage {
  const s = normaliseStatus(label)
  if (!s || s === "NA") return "unknown"
  if (s.startsWith("RTO") || s.includes("RETURN")) {
    return s.endsWith("DELIVERED") ? "returned" : "returning"
  }
  if (s.includes("CANCEL")) return "cancelled"
  if (s === "DELIVERED") return "delivered"
  if (
    s.includes("PICKED UP") ||
    s === "SHIPPED" ||
    s.includes("IN TRANSIT") ||
    s.includes("OUT FOR DELIVERY") ||
    s.includes("REACHED") ||
    s.includes("UNDELIVERED") ||
    s.includes("DELAYED")
  ) {
    return "in_transit"
  }
  if (
    s.includes("AWB") ||
    s.includes("PICKUP") ||
    s.includes("MANIFEST") ||
    s.includes("LABEL") ||
    s === "NEW" ||
    s === "READY TO SHIP"
  ) {
    return "booked"
  }
  return "unknown"
}

/** One tracking update, from either the webhook or a lookup. */
export type TrackingEvent = {
  awb: string | null
  /** Shiprocket's order id - how a shipment booked in their panel finds its order. */
  shiprocketOrderId: string | null
  courier: string | null
  status: string
  at: Date | null
  etd: Date | null
}

const text = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : typeof v === "number" ? String(v) : null

/** Shiprocket's tracking webhook body. Null when it carries no status to apply. */
export function webhookEvent(body: unknown): TrackingEvent | null {
  if (!body || typeof body !== "object") return null
  const b = body as Record<string, unknown>
  const status = text(b.current_status) ?? text(b.shipment_status)
  if (!status) return null

  const scans = Array.isArray(b.scans) ? (b.scans as Array<Record<string, unknown>>) : []
  const lastScan = scans
    .map((s) => parseShiprocketDate(s.date))
    .filter((d): d is Date => d !== null)
    .sort((x, y) => y.getTime() - x.getTime())[0]

  return {
    awb: text(b.awb),
    shiprocketOrderId: text(b.sr_order_id),
    courier: text(b.courier_name),
    status: normaliseStatus(status),
    at: parseShiprocketDate(b.current_timestamp) ?? lastScan ?? null,
    etd: parseShiprocketDate(b.etd),
  }
}

/** GET /courier/track/awb/{awb}. Null when Shiprocket has nothing on it yet. */
export function trackingSnapshot(body: unknown, awb: string): TrackingEvent | null {
  const data = (body as { tracking_data?: Record<string, unknown> } | null)?.tracking_data
  if (!data) return null
  const track = Array.isArray(data.shipment_track)
    ? (data.shipment_track[0] as Record<string, unknown> | undefined)
    : undefined
  const status = text(track?.current_status)
  if (!status) return null

  const activities = Array.isArray(data.shipment_track_activities)
    ? (data.shipment_track_activities as Array<Record<string, unknown>>)
    : []
  const latest = activities
    .map((a) => parseShiprocketDate(a.date))
    .filter((d): d is Date => d !== null)
    .sort((x, y) => y.getTime() - x.getTime())[0]

  return {
    awb,
    shiprocketOrderId: text(track?.order_id),
    courier: text(track?.courier_name),
    status: normaliseStatus(status),
    at: latest ?? null,
    etd: parseShiprocketDate(data.etd) ?? parseShiprocketDate(track?.edd),
  }
}

/** Shiprocket's public tracking page for an AWB, as its own tracking API links it. */
export function trackingUrl(awb: string): string {
  return `https://shiprocket.co/tracking/${encodeURIComponent(awb)}`
}

// ── couriers ───────────────────────────────────────────────────────────────

export type CourierOption = {
  id: number
  name: string
  /** What the shop pays Shiprocket, rupees. */
  rate: number
  /** Estimated delivery date if handed over today, ISO. */
  etd: string | null
  days: number | null
  rating: number | null
  recommended: boolean
}

/**
 * GET /courier/serviceability/, as a list the console can offer: Shiprocket's
 * recommendation first, then cheapest first.
 */
export function courierOptions(body: unknown): {
  options: CourierOption[]
  recommendedId: number | null
} {
  const data = (body as { data?: Record<string, unknown> } | null)?.data
  const list = Array.isArray(data?.available_courier_companies)
    ? (data.available_courier_companies as Array<Record<string, unknown>>)
    : []
  const rec = Number(
    data?.recommended_courier_company_id ?? data?.shiprocket_recommended_courier_id,
  )
  const recommendedId = Number.isFinite(rec) && rec > 0 ? rec : null

  const options = list
    .map((c): CourierOption | null => {
      const id = Number(c.courier_company_id)
      const rate = Number(c.rate ?? c.freight_charge)
      const name = text(c.courier_name)
      if (!Number.isFinite(id) || !name) return null
      const days = Number(c.estimated_delivery_days)
      const rating = Number(c.rating)
      return {
        id,
        name,
        rate: Number.isFinite(rate) ? round(rate, 2) : 0,
        etd: parseShiprocketDate(c.etd)?.toISOString() ?? null,
        days: Number.isFinite(days) && days > 0 ? days : null,
        rating: Number.isFinite(rating) ? rating : null,
        recommended: id === recommendedId,
      }
    })
    .filter((c): c is CourierOption => c !== null)
    .sort((x, y) => Number(y.recommended) - Number(x.recommended) || x.rate - y.rate)

  return { options, recommendedId }
}

/**
 * The delivery estimate to quote a shopper: Shiprocket's recommended courier,
 * which is the one a booking takes by default, else the quickest.
 */
export function deliveryEstimate(options: CourierOption[]): CourierOption | null {
  return (
    options.find((o) => o.recommended) ??
    [...options].sort((x, y) => (x.days ?? Infinity) - (y.days ?? Infinity))[0] ??
    null
  )
}

/**
 * What a shipment costs the shop, read by `basis` (see shippingConfig.fee).
 * Null when no courier quoted a price, which is also when none delivers. A
 * courier without a usable price is left out, not counted as free.
 */
export function shipmentCost(options: CourierOption[], basis: FeeBasis): number | null {
  const priced = options.filter((o) => o.rate > 0)
  if (priced.length === 0) return null
  if (basis === "cheapest") return Math.min(...priced.map((o) => o.rate))
  if (basis === "recommended") {
    return (priced.find((o) => o.recommended) ?? priced.reduce((a, b) => (b.rate < a.rate ? b : a)))
      .rate
  }
  return round(priced.reduce((sum, o) => sum + o.rate, 0) / priced.length, 2)
}

/** The buyer's shipping charge for a shipment that costs the shop `cost`. */
export function shippingFeeFor(
  cost: number | null,
  rule: { aboveRupees: number; feeRupees: number } = shippingConfig.fee,
): number {
  return cost !== null && cost > rule.aboveRupees ? rule.feeRupees : 0
}
