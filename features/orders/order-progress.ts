import type { Tone } from "@/components/shared/status-badge"
import type { PaymentMethod } from "@/features/checkout/payment-options"
import type { TrackingStage } from "@/features/shipping/server/shiprocket-mapping"
import type { OrderStatus } from "@/lib/constants"

/**
 * An order's one status, read the way Shopify's order list reads it: three
 * questions answered apart. Has the money come in? Has it left the building?
 * Where is the parcel? Each answer is worked out here from what the order
 * already records - its status, how it is paid for, and the courier's last
 * word on the shipment - so nothing new is stored and nothing can disagree.
 */

// ── payment ────────────────────────────────────────────────

/**
 * paid            all of it is in
 * partially_paid  the advance is in, the balance is the courier's to collect
 * pending         nothing in yet, and it is still coming
 * voided          nothing in, and none is coming: cancelled, or cash on
 *                 delivery that came back undelivered
 * refunded        it went back to the customer
 */
export type PaymentState = "paid" | "partially_paid" | "pending" | "voided" | "refunded"

export const PAYMENT_STATES: Record<PaymentState, { label: string; tone: Tone }> = {
  paid: { label: "Paid", tone: "success" },
  partially_paid: { label: "Partially paid", tone: "accent" },
  pending: { label: "Payment pending", tone: "accent" },
  voided: { label: "Voided", tone: "neutral" },
  refunded: { label: "Refunded", tone: "neutral" },
}

export function paymentState(status: OrderStatus, method: PaymentMethod): PaymentState {
  switch (status) {
    case "REFUNDED":
      return "refunded"
    case "CANCELLED":
      return "voided"
    case "PENDING":
    case "CONFIRMED":
      return "pending"
    // Cash on delivery is paid at the door.
    case "DELIVERED":
      return "paid"
    // Came back undelivered: whatever was paid online stays paid, and the
    // courier collected nothing.
    case "RETURNED":
      return method === "ONLINE" ? "paid" : method === "PARTIAL" ? "partially_paid" : "voided"
    default:
      return method === "ONLINE" ? "paid" : method === "PARTIAL" ? "partially_paid" : "pending"
  }
}

// ── fulfilment ─────────────────────────────────────────────

/**
 * on_hold      waiting for an online payment; not to be packed yet
 * unfulfilled  to pack
 * packed       packed, waiting for the courier
 * fulfilled    handed to the courier, whatever happened after
 * cancelled    called off, or refunded, before it shipped
 */
export type FulfilmentState = "on_hold" | "unfulfilled" | "packed" | "fulfilled" | "cancelled"

export const FULFILMENT_STATES: Record<FulfilmentState, { label: string; tone: Tone }> = {
  on_hold: { label: "On hold", tone: "neutral" },
  unfulfilled: { label: "Unfulfilled", tone: "accent" },
  packed: { label: "Packed", tone: "accent" },
  fulfilled: { label: "Fulfilled", tone: "success" },
  cancelled: { label: "Cancelled", tone: "neutral" },
}

/** `shipped`: a shipment was booked for it and not called off. */
export function fulfilmentState(status: OrderStatus, shipped: boolean): FulfilmentState {
  switch (status) {
    case "PENDING":
      return "on_hold"
    case "CONFIRMED":
    case "PAID":
      return "unfulfilled"
    case "PACKED":
      return "packed"
    case "SHIPPED":
    case "DELIVERED":
    case "RETURNED":
      return "fulfilled"
    case "CANCELLED":
      return "cancelled"
    // Refunded from wherever it was: shipped first, or refunded instead.
    case "REFUNDED":
      return shipped ? "fulfilled" : "cancelled"
  }
}

// ── delivery ───────────────────────────────────────────────

export type DeliveryKey =
  | "booked"
  | "pickup_scheduled"
  | "in_transit"
  | "out_for_delivery"
  | "attempted"
  | "delivered"
  | "returning"
  | "returned"
  | "cancelled"
  | "other"

export const DELIVERY_STATES: Record<DeliveryKey, { label: string; tone: Tone }> = {
  booked: { label: "Courier booked", tone: "neutral" },
  pickup_scheduled: { label: "Pickup scheduled", tone: "neutral" },
  in_transit: { label: "In transit", tone: "accent" },
  out_for_delivery: { label: "Out for delivery", tone: "accent" },
  attempted: { label: "Delivery attempted", tone: "danger" },
  delivered: { label: "Delivered", tone: "success" },
  returning: { label: "Returning to us", tone: "danger" },
  returned: { label: "Returned to us", tone: "danger" },
  cancelled: { label: "Shipment cancelled", tone: "neutral" },
  other: { label: "", tone: "neutral" },
}

export type DeliveryState = { key: DeliveryKey; label: string }

const delivery = (key: DeliveryKey): DeliveryState => ({ key, label: DELIVERY_STATES[key].label })

/**
 * Where the parcel is. Null before there is one to speak of. `stage` is the
 * courier's status as shipping reads it (trackingStage); the finer points
 * Shopify shows - out for delivery, a failed attempt - come from its words.
 */
export function deliveryState(input: {
  orderStatus: OrderStatus
  /** The shipment's status in the courier's words; null without a shipment. */
  courierStatus: string | null
  stage: TrackingStage | null
  pickupScheduled: boolean
}): DeliveryState | null {
  const { orderStatus, courierStatus, stage, pickupScheduled } = input

  // Shipped or delivered by hand with no shipment on record.
  if (!courierStatus) {
    if (orderStatus === "SHIPPED") return delivery("in_transit")
    if (orderStatus === "DELIVERED") return delivery("delivered")
    if (orderStatus === "RETURNED") return delivery("returned")
    return null
  }

  const words = courierStatus.trim().toUpperCase().replace(/[_-]+/g, " ")
  switch (stage) {
    case "delivered":
      return delivery("delivered")
    case "returned":
      return delivery("returned")
    case "returning":
      return delivery("returning")
    case "cancelled":
      return delivery("cancelled")
    case "in_transit":
      if (words.includes("OUT FOR DELIVERY")) return delivery("out_for_delivery")
      if (words.includes("UNDELIVERED")) return delivery("attempted")
      return delivery("in_transit")
    case "booked":
      return delivery(pickupScheduled || words.includes("PICKUP") ? "pickup_scheduled" : "booked")
    default:
      if (orderStatus === "DELIVERED") return delivery("delivered")
      // Anything else - LOST, DAMAGED - in the courier's own words.
      return { key: "other", label: words.charAt(0) + words.slice(1).toLowerCase() }
  }
}
