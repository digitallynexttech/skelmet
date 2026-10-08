import type { PaymentMethod } from "@/features/checkout/payment-options"
import { ORDER_STATUSES, statusesIn, type OrderScope, type OrderStatus } from "@/lib/constants"

// Order list tabs. The query and the tab count both read these definitions, so they
// cannot disagree. An order is in a view if it matches any clause.

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
  // Not CANCELLED: mostly failed payment attempts, which would bury the real orders.
  all: { label: "All", clauses: [{ statuses: ORDER_STATUSES.filter((s) => s !== "CANCELLED") }] },
  unfulfilled: { label: "Unfulfilled", clauses: [{ statuses: ["CONFIRMED", "PAID", "PACKED"] }] },
  // Payment pending or partially paid, as in order-progress.ts.
  unpaid: {
    label: "Unpaid",
    clauses: [
      { statuses: ["PENDING", "CONFIRMED"] },
      { statuses: ["PAID", "PACKED", "SHIPPED"], methods: ["COD", "PARTIAL"] },
      { statuses: ["RETURNED"], methods: ["PARTIAL"] },
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

/** Only views that can hold something in the scope. */
export function viewsIn(scope: OrderScope): OrderView[] {
  const inScope = statusesIn(scope)
  return ORDER_VIEW_KEYS.filter((view) => {
    const clauses = ORDER_VIEWS[view].clauses
    return !clauses || clauses.some((c) => c.statuses.some((s) => inScope.includes(s)))
  })
}

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
