import type { Tone } from "@/components/shared/status-badge"
import type { PaymentMethod } from "@/features/checkout/payment-options"
import type { TrackingStage } from "@/features/shipping/server/shiprocket-mapping"
import type { OrderStatus } from "@/lib/constants"

// Payment, fulfilment and delivery, as Shopify's list shows them, derived from what
// the order already records so nothing new is stored and nothing can disagree.

// ── payment ────────────────────────────────────────────────

/**
 * partially_paid  the advance is in, the courier collects the balance
 * voided          nothing in and none coming: cancelled, or COD returned undelivered
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
    // COD is paid at the door.
    case "DELIVERED":
      return "paid"
    // Undelivered: what was paid online stays paid; the courier collected nothing.
    case "RETURNED":
      return method === "ONLINE" ? "paid" : method === "PARTIAL" ? "partially_paid" : "voided"
    default:
      return method === "ONLINE" ? "paid" : method === "PARTIAL" ? "partially_paid" : "pending"
  }
}

// ── fulfilment ─────────────────────────────────────────────

/**
 * on_hold    waiting for an online payment; not to be packed yet
 * fulfilled  handed to the courier, whatever happened after
 * expired    never paid, cancelled automatically to free its stock
 * cancelled  by staff, or refunded before it shipped
 */
export type FulfilmentState =
  "on_hold" | "unfulfilled" | "packed" | "fulfilled" | "expired" | "cancelled"

export const FULFILMENT_STATES: Record<
  FulfilmentState,
  { label: string; tone: Tone; title?: string }
> = {
  on_hold: { label: "On hold", tone: "neutral", title: "Waiting for its online payment." },
  unfulfilled: { label: "Unfulfilled", tone: "accent" },
  packed: { label: "Packed", tone: "accent" },
  fulfilled: { label: "Fulfilled", tone: "success" },
  expired: {
    label: "Expired",
    tone: "neutral",
    title:
      "Not paid for in time, so it was cancelled automatically and its stock went back on sale.",
  },
  cancelled: {
    label: "Cancelled by staff",
    tone: "neutral",
    title: "Cancelled from the admin, or refunded before it shipped.",
  },
}

/** `shipped`: a shipment booked and not called off. `cancelledByStaff`: a person, not the clock. */
export function fulfilmentState(
  status: OrderStatus,
  { shipped, cancelledByStaff }: { shipped: boolean; cancelledByStaff: boolean },
): FulfilmentState {
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
      return cancelledByStaff ? "cancelled" : "expired"
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

/** Null before there is a parcel. Out for delivery and failed attempts come from courier words. */
export function deliveryState(input: {
  orderStatus: OrderStatus
  /** Null without a shipment. */
  courierStatus: string | null
  stage: TrackingStage | null
  pickupScheduled: boolean
}): DeliveryState | null {
  const { orderStatus, courierStatus, stage, pickupScheduled } = input

  // Shipped or delivered by hand, no shipment on record.
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
      // LOST, DAMAGED and the like, in the courier's words.
      return { key: "other", label: words.charAt(0) + words.slice(1).toLowerCase() }
  }
}
