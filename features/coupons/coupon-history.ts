/**
 * A discount code's history, cut into runs. A renewed code keeps its row, whose
 * counters only describe the current run; earlier runs come from the audit
 * log's renew events and the orders. Pure, for testing.
 */

export type CouponTerms = {
  kind: "PERCENT" | "FLAT"
  value: string
  minSubtotal: string | null
  maxUses: number | null
}

export type CouponEvent = {
  action: string
  at: string
  by: string | null
  meta: Record<string, unknown> | null
}

export type HistoryOrder = {
  id: string
  number: string
  status: string
  customer: string
  email: string
  at: string
  subtotal: string
  discount: string
  total: string
}

export type CouponRun = {
  index: number
  startedBy: "created" | "renewed"
  start: string
  /** Null for the current run. */
  end: string | null
  expiresAt: string | null
  /** Null for a run older than its audit record. */
  terms: CouponTerms | null
  /** Uses as the code counted them against max uses; null for a run older than its record. */
  uses: number | null
  orders: number
  discount: number
  sales: number
  /** Orders later refunded or returned. */
  refunded: number
}

/** Orders that count towards a run. PENDING and CANCELLED gave the use back. */
export const COUNTED = new Set(["CONFIRMED", "PAID", "PACKED", "SHIPPED", "DELIVERED"])
export const UNDONE = new Set(["REFUNDED", "RETURNED"])

const num = (v: unknown) => (typeof v === "number" || typeof v === "string" ? Number(v) : NaN)

function termsOf(meta: Record<string, unknown> | null): CouponTerms | null {
  if (!meta) return null
  const kind = meta.kind
  const value = num(meta.value)
  if ((kind !== "PERCENT" && kind !== "FLAT") || !Number.isFinite(value)) return null
  const min = num(meta.minSubtotal)
  const max = num(meta.maxUses)
  return {
    kind,
    value: String(value),
    minSubtotal: Number.isFinite(min) ? String(min) : null,
    maxUses: Number.isFinite(max) ? max : null,
  }
}

export function splitRuns(input: {
  createdAt: string
  current: CouponTerms & { expiresAt: string | null; usedCount: number }
  events: CouponEvent[]
  orders: Pick<HistoryOrder, "status" | "at" | "discount" | "total">[]
}): CouponRun[] {
  const byTime = [...input.events].sort((a, b) => a.at.localeCompare(b.at))
  const created = byTime.find((e) => e.action === "coupon:create")
  const renewals = byTime.filter((e) => e.action === "coupon:renew")

  const starts = [
    { at: input.createdAt, event: created ?? null, startedBy: "created" as const },
    ...renewals.map((e) => ({ at: e.at, event: e, startedBy: "renewed" as const })),
  ]

  return starts.map((start, i) => {
    const next = starts[i + 1]
    const last = !next
    const inRun = input.orders.filter((o) => o.at >= start.at && (last || o.at < next.at))
    const counted = inRun.filter((o) => COUNTED.has(o.status))
    return {
      index: i + 1,
      startedBy: start.startedBy,
      start: start.at,
      end: last ? null : next.at,
      // Read from the next renewal's record; the current run's is the code's own.
      expiresAt: last
        ? input.current.expiresAt
        : typeof next.event?.meta?.previousExpiry === "string"
          ? next.event.meta.previousExpiry
          : null,
      terms: last
        ? {
            kind: input.current.kind,
            value: input.current.value,
            minSubtotal: input.current.minSubtotal,
            maxUses: input.current.maxUses,
          }
        : termsOf(start.event?.meta ?? null),
      uses: last
        ? input.current.usedCount
        : typeof next.event?.meta?.previousUses === "number"
          ? next.event.meta.previousUses
          : null,
      orders: counted.length,
      discount: counted.reduce((s, o) => s + Number(o.discount), 0),
      sales: counted.reduce((s, o) => s + Number(o.total), 0),
      refunded: inRun.filter((o) => UNDONE.has(o.status)).length,
    }
  })
}

/** 1-based. */
export function runOf(runs: CouponRun[], at: string): number {
  for (let i = runs.length - 1; i >= 0; i--) if (at >= runs[i]!.start) return runs[i]!.index
  return 1
}
