import "server-only"

// Pure pricing, the authority. `calculateTotals` in use-cart.ts is the browser's preview copy.
export type PriceableLine = { unitPrice: string | number; qty: number }

export type Priced = {
  itemCount: number
  subtotal: number
  discount: number
  shipping: number
  /** The cash-on-delivery charge. */
  paymentFee: number
  total: number
}

export function priceCart(
  lines: PriceableLine[],
  opts: { couponOff?: number; shippingFee?: number; paymentFee?: number } = {},
): Priced {
  const itemCount = lines.reduce((n, l) => n + l.qty, 0)
  // Summed in paise: rupee floats can land a paisa off, and it reaches the gateway.
  const subtotal =
    lines.reduce((sum, l) => sum + Math.round(Number(l.unitPrice) * 100) * l.qty, 0) / 100

  const coupon = Math.max(0, Math.round(opts.couponOff ?? 0))
  // Never past the subtotal, and never off shipping.
  const discount = Math.min(subtotal, coupon)

  // Worked out by placeOrder from the pincode; nothing the browser sends reaches this.
  const shipping = Math.max(0, Math.round(opts.shippingFee ?? 0))
  const paymentFee = Math.max(0, Math.round(opts.paymentFee ?? 0))

  return {
    itemCount,
    subtotal,
    discount,
    shipping,
    paymentFee,
    total: subtotal - discount + shipping + paymentFee,
  }
}

/** A Prisma Decimal fits structurally, without importing its runtime type. */
type Numeric = string | number | { toString(): string }

const num = (v: Numeric): number => Number(typeof v === "object" ? v.toString() : v)

/** Whole rupees off, at most the subtotal; 0 under the minimum spend. */
export function couponReduction(
  coupon: { kind: "PERCENT" | "FLAT"; value: Numeric; minSubtotal: Numeric },
  subtotal: number,
): number {
  if (subtotal < num(coupon.minSubtotal)) return 0
  const value = num(coupon.value)
  const off = coupon.kind === "PERCENT" ? (subtotal * value) / 100 : value
  return Math.min(subtotal, Math.round(off))
}
