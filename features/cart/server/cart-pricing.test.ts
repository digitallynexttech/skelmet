import { describe, expect, it } from "vitest"

import { couponReduction, priceCart } from "@/features/cart/server/cart-pricing"
import { COD_FEE } from "@/lib/constants"

/**
 * Pricing is the one pure module in the money path, and it is the authority -
 * checkout re-runs it against the database rather than trusting the browser.
 * Everything here is about what a customer is charged.
 */
describe("priceCart", () => {
  const line = (unitPrice: string, qty: number) => ({ unitPrice, qty })

  it("multiplies unit price by quantity", () => {
    expect(priceCart([line("3499", 1)]).subtotal).toBe(3499)
    expect(priceCart([line("3499", 2)]).subtotal).toBe(6998)
  })

  it("does not discount for quantity - a coupon is the only reduction", () => {
    expect(priceCart([line("3499", 1)]).discount).toBe(0)
    expect(priceCart([line("3499", 2)]).discount).toBe(0)
    expect(priceCart([line("3499", 5)]).discount).toBe(0)
  })

  it("counts quantity across lines, not the number of lines", () => {
    expect(priceCart([line("3499", 2)]).itemCount).toBe(2)
    expect(priceCart([line("3499", 1), line("3499", 1)]).itemCount).toBe(2)
  })

  it("adds the COD fee only when paying on delivery", () => {
    expect(priceCart([line("3499", 1)], { cod: false }).codFee).toBe(0)
    expect(priceCart([line("3499", 1)], { cod: true }).codFee).toBe(COD_FEE)
  })

  it("totals subtotal minus discount plus the COD fee", () => {
    const p = priceCart([line("3499", 2)], { cod: true })
    expect(p.total).toBe(6998 + COD_FEE)
    expect(p.total).toBe(7047)
  })

  it("applies a coupon and nothing else", () => {
    const p = priceCart([line("3499", 2)], { couponOff: 700 })
    expect(p.discount).toBe(700)
    expect(p.total).toBe(6998 - 700)
  })

  it("never discounts past the subtotal, so an order cannot go negative", () => {
    const p = priceCart([line("100", 1)], { couponOff: 99_999 })
    expect(p.discount).toBe(100)
    expect(p.total).toBe(0)
  })

  it("adds the shipping fee after the coupon, which never reduces it", () => {
    const p = priceCart([line("3499", 1)], { couponOff: 500, shippingFee: 350 })
    expect(p.shipping).toBe(350)
    expect(p.total).toBe(3499 - 500 + 350)
  })

  it("charges no shipping unless told to, and never a negative amount", () => {
    expect(priceCart([line("3499", 1)]).shipping).toBe(0)
    expect(priceCart([line("3499", 1)], { shippingFee: -350 }).total).toBe(3499)
  })

  it("is empty-cart safe", () => {
    const p = priceCart([])
    expect(p).toMatchObject({ itemCount: 0, subtotal: 0, discount: 0, total: 0 })
  })
})

describe("couponReduction", () => {
  const percent = (value: number, minSubtotal = 0) =>
    ({ kind: "PERCENT", value, minSubtotal }) as const
  const flat = (value: number, minSubtotal = 0) => ({ kind: "FLAT", value, minSubtotal }) as const

  it("takes a percentage off", () => {
    expect(couponReduction(percent(10), 6998)).toBe(700)
  })

  it("takes a flat amount off", () => {
    expect(couponReduction(flat(500), 6998)).toBe(500)
  })

  it("gives nothing below the minimum subtotal", () => {
    expect(couponReduction(percent(10, 3000), 2999)).toBe(0)
    expect(couponReduction(percent(10, 3000), 3000)).toBe(300)
  })

  it("caps at the subtotal, so a flat coupon cannot make an order free", () => {
    expect(couponReduction(flat(9_999), 1_000)).toBe(1_000)
  })

  it("accepts Decimal-like values without importing the Prisma runtime", () => {
    // What Prisma actually hands back is an object with toString().
    const decimalish = {
      kind: "FLAT" as const,
      value: { toString: () => "250" },
      minSubtotal: { toString: () => "0" },
    }
    expect(couponReduction(decimalish, 6998)).toBe(250)
  })
})
