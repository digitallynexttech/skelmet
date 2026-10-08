// Money is Decimal(12,2) in Postgres and a string on the wire. Format only here.

const INR = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
})

const INR_PAISE = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
})

/** `1499` → `₹1,499`. Accepts the wire string or a number. */
export function formatMoney(value: string | number): string {
  const n = typeof value === "string" ? Number(value) : value
  if (!Number.isFinite(n)) return "-"
  return Number.isInteger(n) ? INR.format(n) : INR_PAISE.format(n)
}

/** Whole percent off the MRP. Always computed: a hardcoded claim drifts from the prices. */
export function discountPercent(mrp: string | number, price: string | number): number {
  const m = Number(mrp)
  const p = Number(price)
  if (!Number.isFinite(m) || !Number.isFinite(p) || m <= 0 || p >= m) return 0
  return Math.round(((m - p) / m) * 100)
}
