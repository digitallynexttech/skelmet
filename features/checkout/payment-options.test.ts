import { describe, expect, it } from "vitest"

import {
  DEFAULT_PAYMENT_OPTIONS,
  advanceLabel,
  methodFee,
  offered,
  paymentCopy,
  splitPayment,
  statusLabelFor,
} from "@/features/checkout/payment-options"
import {
  paymentOptionsSchema,
  type PaymentOptions,
} from "@/features/settings/schemas/runtime-settings.schema"

const options = (over: Partial<PaymentOptions> = {}): PaymentOptions => ({
  ...structuredClone(DEFAULT_PAYMENT_OPTIONS),
  ...over,
})

describe("offered", () => {
  it("shows an option on test to staff alone, and one that is off to nobody", () => {
    expect(offered("off", true)).toBe(false)
    expect(offered("staff", false)).toBe(false)
    expect(offered("staff", true)).toBe(true)
    expect(offered("everyone", false)).toBe(true)
  })
})

describe("methodFee", () => {
  const charged = options({
    cod: { offer: "everyone", feeRupees: 100 },
    partial: { offer: "everyone", feeRupees: 40, advanceKind: "PERCENT", advanceValue: 20 },
  })

  it("charges each way of paying what the console set, and paying online nothing", () => {
    expect(methodFee(charged, "COD")).toBe(100)
    expect(methodFee(charged, "PARTIAL")).toBe(40)
    expect(methodFee(charged, "ONLINE")).toBe(0)
  })
})

describe("splitPayment", () => {
  it("takes all of it online, or none of it", () => {
    expect(splitPayment("ONLINE", 3499, null)).toEqual({ payNow: 3499, dueOnDelivery: 0 })
    expect(splitPayment("COD", 3599, null)).toEqual({ payNow: 0, dueOnDelivery: 3599 })
  })

  it("leaves the courier whole rupees and puts the odd paise on the advance", () => {
    // 20% of 3599 is 719.80.
    expect(splitPayment("PARTIAL", 3599, { kind: "PERCENT", value: 20 })).toEqual({
      payNow: 720,
      dueOnDelivery: 2879,
    })
    expect(splitPayment("PARTIAL", 3499.5, { kind: "FLAT", value: 500 })).toEqual({
      payNow: 500.5,
      dueOnDelivery: 2999,
    })
  })

  it("always adds back up to the total", () => {
    for (const total of [1, 2, 99, 3499, 6998, 10_497.5]) {
      for (const value of [1, 10, 33, 50, 95]) {
        const split = splitPayment("PARTIAL", total, { kind: "PERCENT", value })
        if (split) expect(split.payNow + split.dueOnDelivery).toBeCloseTo(total, 2)
      }
    }
  })

  it("cannot split an order the advance would cover, or leave under a rupee of", () => {
    expect(splitPayment("PARTIAL", 400, { kind: "FLAT", value: 500 })).toBeNull()
    expect(splitPayment("PARTIAL", 500, { kind: "FLAT", value: 500 })).toBeNull()
    expect(splitPayment("PARTIAL", 1, { kind: "PERCENT", value: 50 })).toBeNull()
    expect(splitPayment("PARTIAL", 3499, null)).toBeNull()
  })
})

describe("the saved options", () => {
  it("start with paying online only", () => {
    expect(DEFAULT_PAYMENT_OPTIONS.cod.offer).toBe("off")
    expect(DEFAULT_PAYMENT_OPTIONS.partial.offer).toBe("off")
    expect(paymentOptionsSchema.safeParse(DEFAULT_PAYMENT_OPTIONS).success).toBe(true)
  })

  it("take whole rupees and a percentage that leaves something for the door", () => {
    const save = (partial: Partial<PaymentOptions["partial"]>) =>
      paymentOptionsSchema.safeParse({
        ...DEFAULT_PAYMENT_OPTIONS,
        partial: { ...DEFAULT_PAYMENT_OPTIONS.partial, ...partial },
      }).success

    expect(save({ advanceKind: "PERCENT", advanceValue: 95 })).toBe(true)
    expect(save({ advanceKind: "PERCENT", advanceValue: 96 })).toBe(false)
    expect(save({ advanceKind: "FLAT", advanceValue: 500 })).toBe(true)
    expect(save({ advanceValue: 0 })).toBe(false)
    expect(save({ feeRupees: -1 })).toBe(false)
    expect(save({ feeRupees: 49.5 })).toBe(false)
  })
})

describe("what the console calls things", () => {
  it("names an advance as it was set", () => {
    expect(advanceLabel({ kind: "PERCENT", value: 20 })).toBe("20%")
    expect(advanceLabel({ kind: "FLAT", value: 500 })).toBe("₹500")
  })

  it("never calls an order with only its advance paid Paid", () => {
    expect(statusLabelFor("PAID", "PARTIAL")).toBe("Advance paid")
    expect(statusLabelFor("PAID", "ONLINE")).toBeUndefined()
    expect(statusLabelFor("PACKED", "PARTIAL")).toBeUndefined()
  })
})

describe("paymentCopy", () => {
  it("says there is no cash on delivery while there is none", () => {
    for (const text of Object.values(paymentCopy(options()))) {
      expect(text).toMatch(/no cash on delivery/)
    }
  })

  it("says nothing of an option that is only on test with staff", () => {
    const testing = options({ cod: { offer: "staff", feeRupees: 100 } })
    expect(paymentCopy(testing)).toEqual(paymentCopy(options()))
  })

  it("states cash on delivery and its charge once everyone is offered it", () => {
    const live = paymentCopy(options({ cod: { offer: "everyone", feeRupees: 100 } }))
    for (const text of Object.values(live)) {
      expect(text).not.toMatch(/no cash on delivery/)
      expect(text).toMatch(/to the courier on delivery, which costs ₹100 extra/)
      expect(text).toMatch(/dispatched within 48 hours of being placed/)
    }
  })

  it("states the advance, as a share or an amount", () => {
    const share = paymentCopy(
      options({
        partial: { offer: "everyone", feeRupees: 0, advanceKind: "PERCENT", advanceValue: 20 },
      }),
    )
    expect(share.faq).toMatch(/pay 20% of the order online as an advance/)
    expect(share.faq).toMatch(/which costs nothing extra/)

    const amount = paymentCopy(
      options({
        partial: { offer: "everyone", feeRupees: 50, advanceKind: "FLAT", advanceValue: 500 },
      }),
    )
    expect(amount.terms).toMatch(/pay ₹500 online as an advance/)
    expect(amount.terms).toMatch(/which costs ₹50 extra/)
  })
})
