import type { PaymentMethod } from "@/features/checkout/payment-options"
import { statusesIn, type OrderScope, type OrderStatus } from "@/lib/constants"

/**
 * The tabs over the order list: the few views staff reach for all day.
 *
 * Each view is described once, here, and both the query that fetches it and
 * the count on its tab are read from that description, so a tab can never
 * say 3 and open on 4. An order is in a view when it matches any of the
 * view's clauses: its status is one the clause names and, where the clause
 * names payment methods too, it was paid for by one of them.
 */

type Clause = { statuses: readonly OrderStatus[]; methods?: readonly PaymentMethod[] }

export const ORDER_VIEW_KEYS = [
  "all",
  "unfulfilled",
  "unpaid",
  "shipped",
  "delivered",
  "returns",
  "cancelled",
] as const

export type OrderView = (typeof ORDER_VIEW_KEYS)[number]

type ViewDef = { label: string; clauses: readonly Clause[] | null }

export const ORDER_VIEWS: Record<OrderView, ViewDef> = {
  all: { label: "All", clauses: null },
  // Not yet handed to a courier: COD accepted, paid, or packed.
  unfulfilled: { label: "Unfulfilled", clauses: [{ statuses: ["CONFIRMED", "PAID", "PACKED"] }] },
  // Money still to come in: an online payment not made yet, cash on delivery
  // not yet delivered, or the balance of an advance the courier collects.
  unpaid: {
    label: "Unpaid",
    clauses: [
      { statuses: ["PENDING", "CONFIRMED"] },
      { statuses: ["PAID", "PACKED", "SHIPPED"], methods: ["COD", "PARTIAL"] },
    ],
  },
  shipped: { label: "In transit", clauses: [{ statuses: ["SHIPPED"] }] },
  delivered: { label: "Delivered", clauses: [{ statuses: ["DELIVERED"] }] },
  returns: { label: "Returns", clauses: [{ statuses: ["RETURNED", "REFUNDED"] }] },
  cancelled: { label: "Cancelled", clauses: [{ statuses: ["CANCELLED"] }] },
}

export function isInView(view: OrderView, status: OrderStatus, method: PaymentMethod): boolean {
  const clauses = ORDER_VIEWS[view].clauses
  if (!clauses) return true
  return clauses.some(
    (c) => c.statuses.includes(status) && (!c.methods || c.methods.includes(method)),
  )
}

/**
 * The views a list offers: those that can hold anything in its scope. The
 * Orders page has no Cancelled tab, since nothing cancelled is in it.
 */
export function viewsIn(scope: OrderScope): OrderView[] {
  const inScope = statusesIn(scope)
  return ORDER_VIEW_KEYS.filter((view) => {
    const clauses = ORDER_VIEWS[view].clauses
    return !clauses || clauses.some((c) => c.statuses.some((s) => inScope.includes(s)))
  })
}

/** The view as a database filter, for the query that lists it. */
export function viewWhere(view: OrderView) {
  const clauses = ORDER_VIEWS[view].clauses
  if (!clauses) return {}
  return {
    OR: clauses.map((c) => ({
      status: { in: [...c.statuses] },
      ...(c.methods ? { paymentMethod: { in: [...c.methods] } } : {}),
    })),
  }
}
