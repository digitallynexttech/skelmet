/**
 * Money is Decimal(12,2) in Postgres and a STRING on the wire (§5).
 * Everything in the UI goes through here so we never format ad hoc.
 */

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

/** Sum wire strings without ever going through float rounding twice. */
export function sumMoney(values: Array<string | number>): number {
  return values.reduce<number>((total, v) => total + Number(v), 0)
}

export function multiplyMoney(unit: string | number, qty: number): number {
  return Number(unit) * qty
}
