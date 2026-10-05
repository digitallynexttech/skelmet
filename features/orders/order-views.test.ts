import { describe, expect, it } from "vitest"

import { PAYMENT_METHODS } from "@/features/checkout/payment-options"
import { ORDER_VIEW_KEYS, isInView, viewWhere, viewsIn } from "@/features/orders/order-views"
import { ORDER_STATUSES } from "@/lib/constants"

describe("the Unpaid tab", () => {
  it("holds orders with money still to come in", () => {
    expect(isInView("unpaid", "PENDING", "ONLINE")).toBe(true)
    expect(isInView("unpaid", "CONFIRMED", "COD")).toBe(true)
    // An advance paid, the balance collected on delivery.
    expect(isInView("unpaid", "SHIPPED", "PARTIAL")).toBe(true)
    expect(isInView("unpaid", "PACKED", "COD")).toBe(true)
  })

  it("leaves out orders paid in full or closed", () => {
    expect(isInView("unpaid", "PAID", "ONLINE")).toBe(false)
    expect(isInView("unpaid", "SHIPPED", "ONLINE")).toBe(false)
    expect(isInView("unpaid", "DELIVERED", "COD")).toBe(false)
    expect(isInView("unpaid", "CANCELLED", "ONLINE")).toBe(false)
  })
})

describe("the All view", () => {
  it("leaves out cancelled orders, which the Cancelled view lists", () => {
    expect(isInView("all", "CANCELLED", "ONLINE")).toBe(false)
    expect(isInView("cancelled", "CANCELLED", "ONLINE")).toBe(true)
    expect(isInView("all", "PENDING", "ONLINE")).toBe(true)
    expect(isInView("all", "REFUNDED", "COD")).toBe(true)
  })
})

describe("viewsIn", () => {
  it("offers no Cancelled tab on Orders, where nothing cancelled is listed", () => {
    expect(viewsIn("paid")).not.toContain("cancelled")
    expect(viewsIn("all")).toEqual([...ORDER_VIEW_KEYS])
  })
})

describe("viewWhere", () => {
  // The count on a tab comes from isInView, the rows from viewWhere: they
  // must pick out the same orders, or a tab says 3 and opens on 4.
  it("filters on exactly what isInView counts", () => {
    for (const view of ORDER_VIEW_KEYS) {
      const where = viewWhere(view)
      for (const status of ORDER_STATUSES) {
        for (const method of PAYMENT_METHODS) {
          const matches =
            where.OR === undefined ||
            where.OR.some(
              (c) =>
                c.status.in.includes(status) &&
                (!("paymentMethod" in c) || c.paymentMethod!.in.includes(method)),
            )
          expect(matches, `${view} ${status} ${method}`).toBe(isInView(view, status, method))
        }
      }
    }
  })
})
