import "server-only"

import { refundPayment } from "@/features/checkout/server/payment-gateway"
import { paginate } from "@/lib/api-response"
import { MAX_PAGE_SIZE, PAGE_SIZE, PERMISSIONS, type OrderStatus } from "@/lib/constants"
import { hasDatabase } from "@/lib/env"
import { createAuditLog, getAuditMeta } from "@/server/audit"
import { fail, ok, runAction, type ActionResult } from "@/server/action-result"
import { requirePermission } from "@/server/action-guard"
import { db } from "@/server/db"

const ORDER_LIST_SELECT = {
  id: true,
  number: true,
  status: true,
  paymentMethod: true,
  email: true,
  phone: true,
  total: true,
  createdAt: true,
  placedAt: true,
  shippingAddress: true,
  _count: { select: { items: true } },
} as const

export type OrderRow = {
  id: string
  number: string
  status: OrderStatus
  paymentMethod: "ONLINE" | "COD"
  email: string
  phone: string
  total: string
  itemCount: number
  customer: string
  city: string
  createdAt: string
  placedAt: string | null
}

type Address = { firstName?: string; lastName?: string; city?: string; state?: string }

function readAddress(json: unknown): Address {
  return (json ?? {}) as Address
}

function serializeRow(row: {
  id: string
  number: string
  status: string
  paymentMethod: string
  email: string
  phone: string
  total: { toString(): string }
  createdAt: Date
  placedAt: Date | null
  shippingAddress: unknown
  _count: { items: number }
}): OrderRow {
  const addr = readAddress(row.shippingAddress)
  return {
    id: row.id,
    number: row.number,
    status: row.status as OrderStatus,
    paymentMethod: row.paymentMethod as "ONLINE" | "COD",
    email: row.email,
    phone: row.phone,
    total: row.total.toString(),
    itemCount: row._count.items,
    customer: [addr.firstName, addr.lastName].filter(Boolean).join(" ") || "Guest",
    city: [addr.city, addr.state].filter(Boolean).join(", ") || "-",
    createdAt: row.createdAt.toISOString(),
    placedAt: row.placedAt?.toISOString() ?? null,
  }
}

/** Admin order queue. Never an unbounded findMany (§7). */
export async function listOrders(params: {
  page?: number
  pageSize?: number
  status?: OrderStatus | "ALL"
  q?: string | null
}): Promise<ActionResult<{ data: OrderRow[]; pagination: unknown }>> {
  return runAction(async () => {
    await requirePermission(PERMISSIONS.ORDER_READ)
    if (!hasDatabase()) return fail("Database not configured.", undefined, 503)

    const page = Math.max(1, params.page ?? 1)
    const size = Math.min(MAX_PAGE_SIZE, Math.max(1, params.pageSize ?? PAGE_SIZE))
    const q = params.q?.trim()

    const where = {
      ...(params.status && params.status !== "ALL" ? { status: params.status } : {}),
      ...(q
        ? {
            OR: [
              { number: { contains: q, mode: "insensitive" as const } },
              { email: { contains: q, mode: "insensitive" as const } },
              { phone: { contains: q } },
            ],
          }
        : {}),
    }

    const [rows, total] = await Promise.all([
      db.order.findMany({
        where,
        select: ORDER_LIST_SELECT,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * size,
        take: size,
      }),
      db.order.count({ where }),
    ])

    return ok(paginate(rows.map(serializeRow), page, size, total))
  })
}

export async function getOrder(id: string): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    await requirePermission(PERMISSIONS.ORDER_READ)
    if (!hasDatabase()) return fail("Database not configured.", undefined, 503)

    const order = await db.order.findUnique({
      where: { id },
      select: {
        id: true,
        number: true,
        status: true,
        paymentMethod: true,
        email: true,
        phone: true,
        subtotal: true,
        discount: true,
        shipping: true,
        tax: true,
        total: true,
        shippingAddress: true,
        createdAt: true,
        placedAt: true,
        coupon: { select: { code: true, kind: true, value: true } },
        items: {
          select: {
            id: true,
            qty: true,
            unitPrice: true,
            nameSnapshot: true,
            variant: { select: { sku: true, colourway: true } },
          },
        },
        payments: {
          select: {
            gateway: true,
            gatewayOrderId: true,
            gatewayPaymentId: true,
            status: true,
            amount: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
        shipment: {
          select: { courier: true, awb: true, status: true, shippedAt: true, deliveredAt: true },
        },
        user: { select: { id: true, name: true, email: true } },
      },
    })

    if (!order) return fail("Order not found.", undefined, 404)

    return ok({
      ...order,
      subtotal: order.subtotal.toString(),
      discount: order.discount.toString(),
      shipping: order.shipping.toString(),
      tax: order.tax.toString(),
      total: order.total.toString(),
      createdAt: order.createdAt.toISOString(),
      placedAt: order.placedAt?.toISOString() ?? null,
      coupon: order.coupon ? { ...order.coupon, value: order.coupon.value.toString() } : null,
      items: order.items.map((i) => ({ ...i, unitPrice: i.unitPrice.toString() })),
      payments: order.payments.map((p) => ({
        ...p,
        amount: p.amount.toString(),
        createdAt: p.createdAt.toISOString(),
      })),
      shipment: order.shipment
        ? {
            ...order.shipment,
            shippedAt: order.shipment.shippedAt?.toISOString() ?? null,
            deliveredAt: order.shipment.deliveredAt?.toISOString() ?? null,
          }
        : null,
    })
  })
}

/**
 * Workflow transitions. Each is its own verb with an atomic `updateMany` claim,
 * never `PATCH { status }` — two operators clicking at once must not both
 * succeed (§5, §7).
 */
async function transition(
  id: string,
  from: OrderStatus[],
  to: OrderStatus,
  scope: (typeof PERMISSIONS)[keyof typeof PERMISSIONS],
  action: string,
  extra?: () => Promise<void>,
): Promise<ActionResult<{ id: string; status: OrderStatus }>> {
  return runAction(async () => {
    const session = await requirePermission(scope)
    if (!hasDatabase()) return fail("Database not configured.", undefined, 503)

    const claimed = await db.order.updateMany({
      where: { id, status: { in: from } },
      data: { status: to },
    })

    if (claimed.count === 0) {
      return fail(
        `That order is not in a state that can be ${action.split(":")[1]}.`,
        undefined,
        409,
      )
    }

    if (extra) await extra()

    await createAuditLog(session, {
      action,
      module: "order",
      entityId: id,
      meta: { to },
      ...(await getAuditMeta()),
    })

    return ok({ id, status: to })
  })
}

/**
 * Cash on delivery is packed while still PENDING, because the money arrives at
 * the door. An unpaid card order must never reach this state, so the COD case
 * is claimed by payment method rather than by widening the status list.
 */
export async function markPacked(id: string) {
  const order = await db.order.findUnique({
    where: { id },
    select: { paymentMethod: true },
  })

  const from: OrderStatus[] = order?.paymentMethod === "COD" ? ["PAID", "PENDING"] : ["PAID"]
  return transition(id, from, "PACKED", PERMISSIONS.ORDER_FULFIL, "order:pack")
}

export async function markShipped(
  id: string,
  input: { courier: string; awb: string },
): Promise<ActionResult<{ id: string; status: OrderStatus }>> {
  return transition(id, ["PACKED"], "SHIPPED", PERMISSIONS.ORDER_FULFIL, "order:ship", async () => {
    await db.shipment.upsert({
      where: { orderId: id },
      create: {
        orderId: id,
        courier: input.courier,
        awb: input.awb,
        status: "IN_TRANSIT",
        shippedAt: new Date(),
      },
      update: {
        courier: input.courier,
        awb: input.awb,
        status: "IN_TRANSIT",
        shippedAt: new Date(),
      },
    })
  })
}

export function markDelivered(id: string) {
  return transition(
    id,
    ["SHIPPED"],
    "DELIVERED",
    PERMISSIONS.ORDER_FULFIL,
    "order:deliver",
    async () => {
      await db.shipment.updateMany({
        where: { orderId: id },
        data: { status: "DELIVERED", deliveredAt: new Date() },
      })

      // COD money changes hands on the doorstep, so this is when the order is
      // genuinely paid and when it should start counting as revenue.
      await db.order.updateMany({
        where: { id, paymentMethod: "COD", placedAt: null },
        data: { placedAt: new Date() },
      })
    },
  )
}

export function cancelOrder(id: string) {
  return transition(
    id,
    ["PENDING", "PAID"],
    "CANCELLED",
    PERMISSIONS.ORDER_WRITE,
    "order:cancel",
    async () => {
      // Put the stock back.
      const items = await db.orderItem.findMany({
        where: { orderId: id },
        select: { variantId: true, qty: true },
      })
      if (items.length === 0) return

      // One batched transaction, not an update per line. Sequential awaits meant
      // a round trip per item, and — worse — a partial restock: the order is
      // already CANCELLED by the time this runs, so a failure halfway left stock
      // permanently short with nothing to replay it from.
      await db.$transaction(
        items.map((item) =>
          db.variant.update({
            where: { id: item.variantId },
            data: { stock: { increment: item.qty } },
          }),
        ),
      )
    },
  )
}

export async function refundOrder(
  id: string,
): Promise<ActionResult<{ id: string; status: OrderStatus }>> {
  return runAction(async () => {
    const session = await requirePermission(PERMISSIONS.ORDER_REFUND)
    if (!hasDatabase()) return fail("Database not configured.", undefined, 503)

    const order = await db.order.findUnique({
      where: { id },
      select: {
        id: true,
        total: true,
        status: true,
        payments: {
          where: { status: "CAPTURED" },
          select: { gatewayPaymentId: true },
          take: 1,
        },
      },
    })
    if (!order) return fail("Order not found.", undefined, 404)

    const claimed = await db.order.updateMany({
      where: { id, status: { in: ["DELIVERED", "RETURNED", "PAID", "PACKED", "SHIPPED"] } },
      data: { status: "REFUNDED" },
    })
    if (claimed.count === 0) return fail("That order cannot be refunded.", undefined, 409)

    const paymentId = order.payments[0]?.gatewayPaymentId
    if (paymentId) {
      await refundPayment({ gatewayPaymentId: paymentId, amountRupees: order.total.toString() })
      await db.payment.updateMany({ where: { orderId: id }, data: { status: "REFUNDED" } })
    }

    await createAuditLog(session, {
      action: "order:refund",
      module: "order",
      entityId: id,
      meta: { amount: order.total.toString(), gateway: Boolean(paymentId) },
      ...(await getAuditMeta()),
    })

    return ok({ id, status: "REFUNDED" as OrderStatus })
  })
}

/** Dashboard counters. One query per tile, all bounded. */
export async function getDashboard(): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    await requirePermission(PERMISSIONS.DASHBOARD_READ)
    if (!hasDatabase()) return fail("Database not configured.", undefined, 503)

    // Date.UTC, never new Date(y, m, d) — that is local midnight and shifts (§6).
    const now = new Date()
    const startOfToday = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    )
    const startOfWeek = new Date(startOfToday.getTime() - 6 * 86_400_000)

    const [todayCount, weekRevenue, awaiting, lowStock, recent] = await Promise.all([
      db.order.count({ where: { createdAt: { gte: startOfToday } } }),
      db.order.aggregate({
        _sum: { total: true },
        where: { placedAt: { gte: startOfWeek }, status: { notIn: ["CANCELLED", "REFUNDED"] } },
      }),
      db.order.count({ where: { status: { in: ["PAID", "PACKED"] } } }),
      db.variant.findMany({
        where: { stock: { lte: 5 } },
        select: { sku: true, colourway: true, stock: true },
        orderBy: { stock: "asc" },
        take: 5,
      }),
      db.order.findMany({
        select: ORDER_LIST_SELECT,
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
    ])

    return ok({
      todayCount,
      weekRevenue: (weekRevenue._sum.total ?? 0).toString(),
      awaiting,
      lowStock,
      recent: recent.map(serializeRow),
    })
  })
}
