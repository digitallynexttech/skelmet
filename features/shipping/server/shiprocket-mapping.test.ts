import { describe, expect, it } from "vitest"

import { shippingConfig } from "@/config/shipping"
import {
  bareMobile,
  buildAdhocOrder,
  courierOptions,
  deliveryEstimate,
  istStamp,
  parcelFor,
  parseShiprocketDate,
  shipmentCost,
  shippingFeeFor,
  trackingSnapshot,
  trackingStage,
  trackingUrl,
  webhookEvent,
  type CourierOption,
  type ShippableOrder,
} from "@/features/shipping/server/shiprocket-mapping"

/**
 * The rules about what Shiprocket is sent and how its answers are read. The
 * fixtures are trimmed from the examples in Shiprocket's published API
 * collection, so a change in their shape shows up here first.
 */

const order: ShippableOrder = {
  number: "SKM-2026-AB12",
  // 09:15 UTC is 14:45 in India.
  placedAt: new Date("2026-09-25T09:15:00Z"),
  email: "rider@example.com",
  phone: "+91 98765 43210",
  paymentMethod: "ONLINE",
  address: {
    firstName: "Asha",
    lastName: "Jangra",
    line1: "B-121, Sector 6",
    line2: "",
    city: "Noida",
    state: "Uttar Pradesh",
    pincode: "201301",
  },
  subtotal: 3499,
  discount: 500,
  shipping: 0,
  items: [
    {
      name: "Flame Skull Mount · Blaze",
      sku: "SKM-BLZ",
      qty: 1,
      unitPrice: 3499,
      weightGrams: null,
    },
  ],
}

describe("buildAdhocOrder", () => {
  const payload = buildAdhocOrder(order, "Noida Workshop")

  it("uses our order number, so a retry can never create a second Shiprocket order", () => {
    expect(payload.order_id).toBe("SKM-2026-AB12")
  })

  it("dates the order on the Indian clock", () => {
    expect(payload.order_date).toBe("2026-09-25 14:45")
  })

  it("names the pickup address it was given", () => {
    expect(payload.pickup_location).toBe("Noida Workshop")
  })

  it("sends the bare ten-digit mobile and a numeric pincode", () => {
    expect(payload.billing_phone).toBe(9876543210)
    expect(payload.billing_pincode).toBe(201301)
    expect(payload.shipping_is_billing).toBe(true)
  })

  it("is prepaid for an online order and COD for a cash one", () => {
    expect(payload.payment_method).toBe("Prepaid")
    expect(buildAdhocOrder({ ...order, paymentMethod: "COD" }, "x").payment_method).toBe("COD")
  })

  it("sends the sub-total after the coupon, since Shiprocket computes no totals", () => {
    expect(payload.sub_total).toBe(2999)
    expect(payload.total_discount).toBe(500)
  })

  it("lists each line with its units and unit price", () => {
    expect(payload.order_items).toEqual([
      { name: "Flame Skull Mount · Blaze", sku: "SKM-BLZ", units: 1, selling_price: 3499 },
    ])
  })

  it("caps the city at Shiprocket's 30 characters", () => {
    const long = { ...order, address: { ...order.address, city: "A".repeat(45) } }
    expect(buildAdhocOrder(long, "x").billing_city).toHaveLength(30)
  })
})

describe("parcelFor", () => {
  it("falls back to the default packed weight", () => {
    const p = parcelFor(order.items)
    expect(p.weightKg).toBe(shippingConfig.defaultPackedWeightGrams / 1000)
    expect(p.heightCm).toBe(shippingConfig.box.heightCm)
  })

  it("prefers a variant's own weight, and stacks units on the height", () => {
    const p = parcelFor([{ ...order.items[0]!, qty: 2, weightGrams: 450 }])
    expect(p.weightKg).toBe(0.9)
    expect(p.heightCm).toBe(shippingConfig.box.heightCm * 2)
  })

  it("never sends a zero weight, which Shiprocket rejects", () => {
    expect(parcelFor([{ ...order.items[0]!, weightGrams: 0 }]).weightKg).toBeGreaterThan(0)
  })
})

describe("small readers", () => {
  it("strips a mobile to its last ten digits", () => {
    expect(bareMobile("+91-98765 43210")).toBe("9876543210")
    expect(bareMobile("9876543210")).toBe("9876543210")
  })

  it("writes IST stamps across midnight UTC", () => {
    expect(istStamp(new Date("2026-09-25T20:00:00Z"))).toBe("2026-09-26 01:30")
  })

  it("links Shiprocket's tracking page for an AWB", () => {
    expect(trackingUrl("141123221084922")).toBe("https://shiprocket.co/tracking/141123221084922")
  })
})

describe("parseShiprocketDate", () => {
  it("reads the usual timestamp as Indian time", () => {
    expect(parseShiprocketDate("2023-05-23 15:40:19")?.toISOString()).toBe(
      "2023-05-23T10:10:19.000Z",
    )
  })

  it("reads a webhook's day-first current_timestamp", () => {
    expect(parseShiprocketDate("23 05 2023 11:43:52")?.toISOString()).toBe(
      "2023-05-23T06:13:52.000Z",
    )
  })

  it("reads a serviceability etd", () => {
    expect(parseShiprocketDate("Sep 27, 2026")?.toISOString()).toBe("2026-09-26T18:30:00.000Z")
  })

  it("refuses to guess", () => {
    expect(parseShiprocketDate("NA")).toBeNull()
    expect(parseShiprocketDate("")).toBeNull()
    expect(parseShiprocketDate(null)).toBeNull()
    expect(parseShiprocketDate("Foo 12, 2026")).toBeNull()
  })
})

describe("trackingStage", () => {
  it.each([
    ["AWB ASSIGNED", "booked"],
    ["PICKUP SCHEDULED", "booked"],
    ["OUT FOR PICKUP", "booked"],
    ["MANIFEST GENERATED", "booked"],
    ["PICKED UP", "in_transit"],
    ["IN TRANSIT", "in_transit"],
    ["OUT FOR DELIVERY", "in_transit"],
    ["REACHED AT DESTINATION HUB", "in_transit"],
    ["UNDELIVERED", "in_transit"],
    ["DELIVERED", "delivered"],
    ["Delivered", "delivered"],
    ["RTO INITIATED", "returning"],
    ["RTO_IN_TRANSIT", "returning"],
    ["RTO DELIVERED", "returned"],
    ["CANCELED", "cancelled"],
    ["LOST", "unknown"],
    ["NA", "unknown"],
  ])("%s is %s", (label, stage) => {
    expect(trackingStage(label)).toBe(stage)
  })
})

describe("webhookEvent", () => {
  const body = {
    awb: "19041424751540",
    courier_name: "Delhivery Surface",
    current_status: "IN TRANSIT",
    current_status_id: 20,
    shipment_status: "IN TRANSIT",
    current_timestamp: "23 05 2023 11:43:52",
    order_id: "1373900_150876814",
    sr_order_id: 348456385,
    etd: "2023-05-23 15:40:19",
    scans: [{ date: "2023-05-19 11:59:16", status: "X-UCI", activity: "Manifested" }],
  }

  it("reads the AWB, Shiprocket's order id, the status and both dates", () => {
    const e = webhookEvent(body)
    expect(e).toMatchObject({
      awb: "19041424751540",
      shiprocketOrderId: "348456385",
      courier: "Delhivery Surface",
      status: "IN TRANSIT",
    })
    expect(e?.at?.toISOString()).toBe("2023-05-23T06:13:52.000Z")
    expect(e?.etd?.toISOString()).toBe("2023-05-23T10:10:19.000Z")
  })

  it("falls back to the newest scan when there is no current_timestamp", () => {
    const e = webhookEvent({ ...body, current_timestamp: undefined })
    expect(e?.at?.toISOString()).toBe("2023-05-19T06:29:16.000Z")
  })

  it("ignores a body with no status", () => {
    expect(webhookEvent({ awb: "1" })).toBeNull()
    expect(webhookEvent("nonsense")).toBeNull()
  })
})

describe("trackingSnapshot", () => {
  it("reads the latest status and activity from a tracking lookup", () => {
    const e = trackingSnapshot(
      {
        tracking_data: {
          shipment_track: [
            { current_status: "Delivered", courier_name: "Xpressbees", order_id: 1 },
          ],
          shipment_track_activities: [
            { date: "2022-07-19 08:57:00", activity: "Out for Delivery" },
            { date: "2022-07-19 11:37:00", activity: "Delivered" },
          ],
          etd: "2022-07-20 19:28:00",
        },
      },
      "141123221084922",
    )
    expect(e?.status).toBe("DELIVERED")
    expect(e?.at?.toISOString()).toBe("2022-07-19T06:07:00.000Z")
    expect(e?.awb).toBe("141123221084922")
  })

  it("is null before Shiprocket has anything on the AWB", () => {
    expect(trackingSnapshot({ tracking_data: { shipment_track: [] } }, "1")).toBeNull()
    expect(trackingSnapshot(null, "1")).toBeNull()
  })
})

describe("courierOptions", () => {
  const body = {
    data: {
      recommended_courier_company_id: 6,
      available_courier_companies: [
        {
          courier_company_id: 1,
          courier_name: "Blue Dart Air",
          rate: 211.92,
          estimated_delivery_days: "2",
          etd: "Sep 27, 2026",
          rating: 4.5,
        },
        {
          courier_company_id: 33,
          courier_name: "Xpressbees Air",
          rate: 132.72,
          estimated_delivery_days: "3",
          etd: "Sep 28, 2026",
        },
        {
          courier_company_id: 6,
          courier_name: "DTDC Surface",
          rate: 172.62,
          estimated_delivery_days: "4",
          etd: "Sep 29, 2026",
        },
        { courier_company_id: "x", courier_name: "Broken" },
      ],
    },
  }

  it("puts Shiprocket's pick first, then cheapest first, and drops junk", () => {
    const { options, recommendedId } = courierOptions(body)
    expect(recommendedId).toBe(6)
    expect(options.map((o) => o.id)).toEqual([6, 33, 1])
    expect(options[0]).toMatchObject({
      name: "DTDC Surface",
      rate: 172.62,
      days: 4,
      recommended: true,
    })
  })

  it("quotes the recommended courier's time, else the quickest", () => {
    expect(deliveryEstimate(courierOptions(body).options)?.days).toBe(4)
    const noPick = courierOptions({ data: { ...body.data, recommended_courier_company_id: 0 } })
    expect(deliveryEstimate(noPick.options)?.days).toBe(2)
  })

  it("is empty, not broken, for an unserviceable pincode", () => {
    expect(courierOptions({ data: { available_courier_companies: [] } }).options).toEqual([])
    expect(courierOptions({ status: 404, message: "no couriers" }).options).toEqual([])
  })
})

describe("what shipping costs, and what the buyer pays", () => {
  const courier = (rate: number, recommended = false): CourierOption => ({
    id: Math.round(rate),
    name: `Courier ${rate}`,
    rate,
    etd: null,
    days: 2,
    rating: null,
    recommended,
  })
  // Delhi to Delhi for one mount, as Shiprocket quoted it: a few cheap surface
  // couriers and the air couriers it always lists.
  const delhi = [161, 202, 208, 231, 344, 392, 414, 556, 635].map((r) => courier(r, r === 231))

  it("reads the cost four ways", () => {
    expect(shipmentCost(delhi, "twoCheapest")).toBe(181.5)
    expect(shipmentCost(delhi, "average")).toBe(349.22)
    expect(shipmentCost(delhi, "cheapest")).toBe(161)
    expect(shipmentCost(delhi, "recommended")).toBe(231)
  })

  it("averages the two cheapest in any order, or takes the only one", () => {
    // Ghaziabad as quoted: the second courier lifts it over the threshold.
    const ghaziabad = [726, 226, 455].map((r) => courier(r))
    expect(shipmentCost(ghaziabad, "twoCheapest")).toBe(340.5)
    // Half of the Rs 40.50 above Rs 300, to the rupee.
    expect(shippingFeeFor(shipmentCost(ghaziabad, "twoCheapest"))).toBe(20)
    expect(shipmentCost([courier(869)], "twoCheapest")).toBe(869)
    expect(shippingFeeFor(shipmentCost(delhi, "twoCheapest"))).toBe(0)
  })

  it("falls back to the cheapest when Shiprocket recommends nothing", () => {
    expect(shipmentCost([courier(869), courier(400)], "recommended")).toBe(400)
  })

  it("leaves out a courier with no usable price rather than counting it free", () => {
    expect(shipmentCost([courier(0), courier(300), courier(500)], "average")).toBe(400)
    expect(shipmentCost([courier(0)], "average")).toBeNull()
    expect(shipmentCost([], "cheapest")).toBeNull()
  })

  it("charges the buyer their share of what the courier costs above the threshold", () => {
    const rule = { aboveRupees: 300, sharePercent: 50 }
    expect(shippingFeeFor(161, rule)).toBe(0)
    expect(shippingFeeFor(300, rule)).toBe(0)
    expect(shippingFeeFor(500, rule)).toBe(100)
    expect(shippingFeeFor(964, rule)).toBe(332)
    expect(shippingFeeFor(301, rule)).toBe(1)
    expect(shippingFeeFor(null, rule)).toBe(0)
    expect(shippingFeeFor(500, { aboveRupees: 300, sharePercent: 100 })).toBe(200)
    expect(shippingFeeFor(500, { aboveRupees: 300, sharePercent: 0 })).toBe(0)
  })

  it("uses the shop's configured rule by default: half of what is above Rs 300", () => {
    expect(shippingConfig.fee).toMatchObject({ aboveRupees: 300, sharePercent: 50 })
    expect(shippingFeeFor(500)).toBe(100)
    expect(shippingFeeFor(300)).toBe(0)
  })
})
