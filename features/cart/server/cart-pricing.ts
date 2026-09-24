import "server-only"

import { COD_FEE } from "@/lib/constants"

/**
 * Pure pricing. The browser's copy in `use-cart.ts` is a preview only - this is
 * the authority, and checkout recomputes from the database rather than trusting
 * anything the client sends.
 */
export type PriceableLine = { unitPrice: string | number; qty: number }

export type Priced = {
  itemCount: number
  subtotal: number
  discount: number
  shipping: number
  codFee: number
  total: number
}

export function priceCart(
  lines: PriceableLine[],
  opts: { cod?: boolean; couponOff?: number } = {},
): Priced {
  const itemCount = lines.reduce((n, l) => n + l.qty, 0)
  const subtotal = lines.reduce((sum, l) => sum + Number(l.unitPrice) * l.qty, 0)

  const coupon = Math.max(0, Math.round(opts.couponOff ?? 0))
  // A coupon is the only discount now; never take it past the subtotal,
  // which would make an order negative.
  const discount = Math.min(subtotal, coupon)

  const shipping = 0
  const codFee = opts.cod ? COD_FEE : 0

  return {
    itemCount,
    subtotal,
    discount,
    shipping,
    codFee,
    total: subtotal - discount + shipping + codFee,
  }
}

/**
 * Anything Prisma hands back as a Decimal satisfies this structurally, so the
 * pricing module never has to import the Decimal runtime type.
 */
type Numeric = string | number | { toString(): string }

const num = (v: Numeric): number => Number(typeof v === "object" ? v.toString() : v)

/** Percent and flat coupons, capped so a bad code cannot make an order free. */
export function couponReduction(
  coupon: { kind: "PERCENT" | "FLAT"; value: Numeric; minSubtotal: Numeric },
  subtotal: number,
): number {
  if (subtotal < num(coupon.minSubtotal)) return 0
  const value = num(coupon.value)
  const off = coupon.kind === "PERCENT" ? (subtotal * value) / 100 : value
  return Math.min(subtotal, Math.round(off))
}
