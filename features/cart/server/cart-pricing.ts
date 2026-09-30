import "server-only"

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
  /** What the way of paying adds - the cash-on-delivery charge. */
  paymentFee: number
  total: number
}

export function priceCart(
  lines: PriceableLine[],
  opts: { couponOff?: number; shippingFee?: number; paymentFee?: number } = {},
): Priced {
  const itemCount = lines.reduce((n, l) => n + l.qty, 0)
  // Summed in paise and divided once: adding rupee floats line by line can
  // land a paisa off (0.1 + 0.2), and that paisa reaches the gateway.
  const subtotal =
    lines.reduce((sum, l) => sum + Math.round(Number(l.unitPrice) * 100) * l.qty, 0) / 100

  const coupon = Math.max(0, Math.round(opts.couponOff ?? 0))
  // A coupon is the only discount now; never take it past the subtotal,
  // which would make an order negative. It never touches shipping.
  const discount = Math.min(subtotal, coupon)

  // Set by the delivery pincode (shippingConfig.fee). placeOrder passes the fee
  // it worked out itself; nothing the browser sends reaches this.
  const shipping = Math.max(0, Math.round(opts.shippingFee ?? 0))
  // Set in the console (Settings > Pay on delivery) and passed in by
  // placeOrder for the method chosen; paying online adds nothing.
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
