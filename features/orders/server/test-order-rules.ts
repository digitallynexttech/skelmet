import type { PaymentMethod } from "@/features/checkout/payment-options"
import { modeOfPayment } from "@/features/checkout/server/payment-gateway"
import type { PaymentConfig } from "@/features/settings/server/runtime-settings"
import type { TrackingStage } from "@/features/shipping/server/shiprocket-mapping"
import type { OrderStatus } from "@/lib/constants"

/**
 * What marks an order as real, for deleting test orders (test-orders.ts).
 * Apart from the service so the order list can say which were paid in test
 * mode without loading it.
 */

/** Payment statuses where money actually moved. */
const MONEY_MOVED = ["AUTHORIZED", "CAPTURED", "REFUNDED"] as const

/** Where a Shiprocket parcel is still with the courier. */
const WITH_COURIER: TrackingStage[] = ["booked", "in_transit", "returning"]

/**
 * The Razorpay account each payment that moved money went through. An order
 * with none took no money online.
 */
export function moneyModes(
  payments: Array<{ status: string; mode: string | null }>,
  config: Pick<PaymentConfig, "envMode" | "mode">,
): Array<"test" | "live"> {
  return payments
    .filter((p) => (MONEY_MOVED as readonly string[]).includes(p.status))
    .map((p) => modeOfPayment(p.mode, config))
}

export type DeletionCandidate = {
  status: OrderStatus
  paymentMethod: PaymentMethod
  invoiceNumber: string | null
  creditNoteNumber: string | null
  moneyModes: Array<"test" | "live">
  shipment: { provider: string; stage: TrackingStage } | null
}

/** Why an order has to stay, or null when it may be deleted. */
export function whyKeep(o: DeletionCandidate): string | null {
  if (o.moneyModes.includes("live")) return "Paid with real money through Razorpay."
  if (o.status === "PENDING") {
    return "Still waiting for its payment, which could yet arrive. It cancels itself within the hour; delete it after that."
  }
  if (o.paymentMethod !== "ONLINE" && o.status === "DELIVERED") {
    return "Delivered, with cash collected at the door."
  }
  if (o.invoiceNumber || o.creditNoteNumber) {
    return `Has ${o.invoiceNumber ? `tax invoice ${o.invoiceNumber}` : `credit note ${o.creditNoteNumber}`}; deleting it would leave a gap in the numbering.`
  }
  if (o.shipment?.provider === "shiprocket" && WITH_COURIER.includes(o.shipment.stage)) {
    return "Its parcel is still with the courier. Cancel it in Shiprocket first."
  }
  return null
}
