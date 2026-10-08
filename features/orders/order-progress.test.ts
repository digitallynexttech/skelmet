import { describe, expect, it } from "vitest"

import { PAYMENT_METHODS } from "@/features/checkout/payment-options"
import { deliveryState, fulfilmentState, paymentState } from "@/features/orders/order-progress"
import { isInView } from "@/features/orders/order-views"
import { trackingStage } from "@/features/shipping/server/shiprocket-mapping"
import { ORDER_STATUSES } from "@/lib/constants"

describe("paymentState", () => {
  it("reads an order paid online as paid from the moment it is paid", () => {
    expect(paymentState("PENDING", "ONLINE")).toBe("pending")
    expect(paymentState("PAID", "ONLINE")).toBe("paid")
    expect(paymentState("SHIPPED", "ONLINE")).toBe("paid")
  })

  it("keeps cash on delivery pending until the door, and void if it comes back", () => {
    expect(paymentState("CONFIRMED", "COD")).toBe("pending")
    expect(paymentState("SHIPPED", "COD")).toBe("pending")
    expect(paymentState("DELIVERED", "COD")).toBe("paid")
    expect(paymentState("RETURNED", "COD")).toBe("voided")
  })

  it("calls an advance partly paid until the balance is collected", () => {
    expect(paymentState("PENDING", "PARTIAL")).toBe("pending")
    expect(paymentState("PAID", "PARTIAL")).toBe("partially_paid")
    expect(paymentState("SHIPPED", "PARTIAL")).toBe("partially_paid")
    expect(paymentState("DELIVERED", "PARTIAL")).toBe("paid")
    expect(paymentState("RETURNED", "PARTIAL")).toBe("partially_paid")
  })

  it("marks cancelled and refunded orders whatever the method", () => {
    for (const method of PAYMENT_METHODS) {
      expect(paymentState("CANCELLED", method)).toBe("voided")
      expect(paymentState("REFUNDED", method)).toBe("refunded")
    }
  })

  it("is pending or partly paid exactly where the Unpaid tab lists an order", () => {
    for (const status of ORDER_STATUSES) {
      for (const method of PAYMENT_METHODS) {
        const owed = ["pending", "partially_paid"].includes(paymentState(status, method))
        expect(owed, `${status} ${method}`).toBe(isInView("unpaid", status, method))
      }
    }
  })
})

describe("fulfilmentState", () => {
  const unshipped = { shipped: false, cancelledByStaff: false }
  const shipped = { shipped: true, cancelledByStaff: false }

  it("holds an unpaid online order, and fulfils once the courier has it", () => {
    expect(fulfilmentState("PENDING", unshipped)).toBe("on_hold")
    expect(fulfilmentState("PAID", unshipped)).toBe("unfulfilled")
    expect(fulfilmentState("PACKED", unshipped)).toBe("packed")
    expect(fulfilmentState("SHIPPED", shipped)).toBe("fulfilled")
    expect(fulfilmentState("RETURNED", shipped)).toBe("fulfilled")
  })

  it("tells an order that expired unpaid from one staff cancelled", () => {
    expect(fulfilmentState("CANCELLED", unshipped)).toBe("expired")
    expect(fulfilmentState("CANCELLED", { ...unshipped, cancelledByStaff: true })).toBe("cancelled")
  })

  it("says a refund before shipping cancelled the fulfilment", () => {
    expect(fulfilmentState("REFUNDED", unshipped)).toBe("cancelled")
    expect(fulfilmentState("REFUNDED", shipped)).toBe("fulfilled")
  })

  it("is unfulfilled or packed exactly where the Unfulfilled tab lists an order", () => {
    for (const status of ORDER_STATUSES) {
      const open = ["unfulfilled", "packed"].includes(fulfilmentState(status, unshipped))
      expect(open, status).toBe(isInView("unfulfilled", status, "ONLINE"))
    }
  })
})

describe("deliveryState", () => {
  const from = (courierStatus: string | null, orderStatus = "SHIPPED" as const) =>
    deliveryState({
      orderStatus,
      courierStatus,
      stage: courierStatus ? trackingStage(courierStatus) : null,
      pickupScheduled: false,
    })

  it("is blank before there is a parcel", () => {
    expect(
      deliveryState({
        orderStatus: "PAID",
        courierStatus: null,
        stage: null,
        pickupScheduled: false,
      }),
    ).toBeNull()
  })

  it("reads the courier's words the way Shopify shows them", () => {
    expect(from("AWB ASSIGNED")?.label).toBe("Courier booked")
    expect(from("PICKUP SCHEDULED")?.label).toBe("Pickup scheduled")
    expect(from("IN TRANSIT")?.label).toBe("In transit")
    expect(from("OUT FOR DELIVERY")?.label).toBe("Out for delivery")
    expect(from("UNDELIVERED")?.label).toBe("Delivery attempted")
    expect(from("DELIVERED")?.label).toBe("Delivered")
    expect(from("RTO IN TRANSIT")?.label).toBe("Returning to us")
    expect(from("RTO DELIVERED")?.label).toBe("Returned to us")
  })

  it("passes on anything else in the courier's own words", () => {
    expect(from("LOST")).toEqual({ key: "other", label: "Lost" })
  })

  it("falls back on the order for a shipment entered by hand", () => {
    expect(from(null)?.label).toBe("In transit")
  })
})
