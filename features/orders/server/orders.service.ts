import "server-only"

import { releaseStaleOrders } from "@/features/checkout/server/checkout.service"
import { queueInvoiceEmail } from "@/features/invoices/server/invoice.service"
import { modeOfPayment, refundPayment } from "@/features/checkout/server/payment-gateway"
import { paymentConfig } from "@/features/settings/server/runtime-settings"
import { manualShipmentSchema } from "@/features/shipping/schemas/shipping.schema"
import { isShiprocketConfigured } from "@/features/shipping/server/shiprocket"
import { trackingUrl } from "@/features/shipping/server/shiprocket-mapping"
import { cancelShiprocketOrder, notifyShipped } from "@/features/shipping/server/shipping.service"
import { paginate } from "@/lib/api-response"
import {
  MAX_PAGE_SIZE,
  ORDER_STATUSES,
  PAGE_SIZE,
  PERMISSIONS,
  type OrderStatus,
} from "@/lib/constants"
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
}): Promise<
  ActionResult<{
    data: OrderRow[]
    pagination: unknown
    counts: Record<OrderStatus, number>
    allCount: number
  }>
> {
  return runAction(async () => {
    await requirePermission(PERMISSIONS.ORDER_READ)
    if (!hasDatabase()) return fail("Database not configured.", undefined, 503)

    // So the list staff read never shows an abandoned checkout as live.
    await releaseStaleOrders()

    const page = Math.max(1, params.page ?? 1)
    const size = Math.min(MAX_PAGE_SIZE, Math.max(1, params.pageSize ?? PAGE_SIZE))
    const q = params.q?.trim()

    // The search narrows the counts; the status filter does not. A tile
    // showing "Shipped 4" has to keep saying 4 while you are looking at the
    // shipped ones, or the board stops being a board.
    const searched = q
      ? {
          OR: [
            { number: { contains: q, mode: "insensitive" as const } },
            { email: { contains: q, mode: "insensitive" as const } },
            { phone: { contains: q } },
          ],
        }
      : {}

    const where = {
      ...searched,
      ...(params.status && params.status !== "ALL" ? { status: params.status } : {}),
    }

    const [rows, total, grouped] = await Promise.all([
      db.order.findMany({
        where,
        select: ORDER_LIST_SELECT,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * size,
        take: size,
      }),
      db.order.count({ where }),
      // One grouped query rather than eight counts.
      db.order.groupBy({ by: ["status"], where: searched, _count: { _all: true } }),
    ])

    // Every status is present, including the ones at zero: a tile that
    // disappears when it empties is a tile you cannot trust to be there.
    const counts = Object.fromEntries(ORDER_STATUSES.map((s) => [s, 0])) as Record<
      OrderStatus,
      number
    >
    let all = 0
    for (const g of grouped) {
      const n = g._count._all
      counts[g.status as OrderStatus] = n
      all += n
    }

    return ok({ ...paginate(rows.map(serializeRow), page, size, total), counts, allCount: all })
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
            mode: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
        shiprocketOrderId: true,
        invoiceNumber: true,
        invoicedAt: true,
        invoiceEmailedAt: true,
        shipment: {
          select: {
            courier: true,
            awb: true,
            status: true,
            provider: true,
            labelUrl: true,
            manifestUrl: true,
            pickupScheduledAt: true,
            etd: true,
            statusAt: true,
            shippedAt: true,
            deliveredAt: true,
          },
        },
        user: { select: { id: true, name: true, email: true } },
      },
    })

    if (!order) return fail("Order not found.", undefined, 404)
    const payments = await paymentConfig()

    return ok({
      ...order,
      subtotal: order.subtotal.toString(),
      discount: order.discount.toString(),
      shipping: order.shipping.toString(),
      tax: order.tax.toString(),
      total: order.total.toString(),
      createdAt: order.createdAt.toISOString(),
      placedAt: order.placedAt?.toISOString() ?? null,
      invoicedAt: order.invoicedAt?.toISOString() ?? null,
      invoiceEmailedAt: order.invoiceEmailedAt?.toISOString() ?? null,
      coupon: order.coupon ? { ...order.coupon, value: order.coupon.value.toString() } : null,
      items: order.items.map((i) => ({ ...i, unitPrice: i.unitPrice.toString() })),
      payments: order.payments.map((p) => ({
        ...p,
        mode: p.gateway === "razorpay" ? modeOfPayment(p.mode, payments) : null,
        amount: p.amount.toString(),
        createdAt: p.createdAt.toISOString(),
      })),
      shipment: order.shipment
        ? {
            ...order.shipment,
            pickupScheduledAt: order.shipment.pickupScheduledAt?.toISOString() ?? null,
            etd: order.shipment.etd?.toISOString() ?? null,
            statusAt: order.shipment.statusAt?.toISOString() ?? null,
            shippedAt: order.shipment.shippedAt?.toISOString() ?? null,
            deliveredAt: order.shipment.deliveredAt?.toISOString() ?? null,
            trackingUrl:
              order.shipment.provider === "shiprocket" && order.shipment.awb
                ? trackingUrl(order.shipment.awb)
                : null,
          }
        : null,
      // Whether the console can book couriers here, or only take them typed in.
      shiprocket: { configured: await isShiprocketConfigured(), orderId: order.shiprocketOrderId },
    })
  })
}

/**
 * Workflow transitions. Each is its own verb with an atomic `updateMany` claim,
 * never `PATCH { status }` - two operators clicking at once must not both
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

/**
 * Ships with a courier and AWB typed in by hand - for anything not booked
 * through Shiprocket (see shipping.service for that). Validated before the
 * claim, so a bad body can no longer leave the order SHIPPED with no shipment.
 */
export async function markShipped(
  id: string,
  raw: unknown,
): Promise<ActionResult<{ id: string; status: OrderStatus }>> {
  const input = manualShipmentSchema.parse(raw)
  const shipment = {
    provider: "manual",
    courier: input.courier,
    awb: input.awb,
    status: "IN TRANSIT",
    statusAt: new Date(),
    shippedAt: new Date(),
  }
  const result = await transition(
    id,
    ["PACKED"],
    "SHIPPED",
    PERMISSIONS.ORDER_FULFIL,
    "order:ship",
    async () => {
      await db.shipment.upsert({
        where: { orderId: id },
        create: { orderId: id, ...shipment },
        update: shipment,
      })
    },
  )
  if (result.ok) notifyShipped(id)
  return result
}

export async function markDelivered(id: string) {
  const result = await transition(
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
  // The invoice goes to the customer once the parcel is in their hands.
  if (result.ok) queueInvoiceEmail(id)
  return result
}

export function cancelOrder(id: string) {
  // Unpaid orders only. Cancelling a PAID one used to restock it and keep the
  // customer's money, with no way to refund it afterwards - refund refused a
  // CANCELLED order. A paid order is taken back with Refund, which returns the
  // money and restocks what never shipped, and needs the refund permission
  // that handing money back should need.
  return transition(
    id,
    ["PENDING"],
    "CANCELLED",
    PERMISSIONS.ORDER_WRITE,
    "order:cancel",
    async () => {
      const order = await db.order.findUnique({
        where: { id },
        select: { couponId: true, items: { select: { variantId: true, qty: true } } },
      })
      if (!order) return

      // One batched transaction, not an update per line. Sequential awaits meant
      // a round trip per item, and - worse - a partial restock: the order is
      // already CANCELLED by the time this runs, so a failure halfway left stock
      // permanently short with nothing to replay it from.
      await db.$transaction([
        ...order.items.map((item) =>
          db.variant.update({
            where: { id: item.variantId },
            data: { stock: { increment: item.qty } },
          }),
        ),
        // The coupon use it claimed at checkout goes back too.
        ...(order.couponId
          ? [
              db.coupon.updateMany({
                where: { id: order.couponId, usedCount: { gt: 0 } },
                data: { usedCount: { decrement: 1 } },
              }),
            ]
          : []),
      ])
    },
  )
}

/** Statuses whose goods never left the building, so a refund puts them back on sale. */
const UNSHIPPED: OrderStatus[] = ["PAID", "PACKED"]

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
        items: { select: { variantId: true, qty: true } },
        payments: {
          where: { status: "CAPTURED" },
          select: { gatewayPaymentId: true, mode: true },
          take: 1,
        },
      },
    })
    if (!order) return fail("Order not found.", undefined, 404)

    const paymentId = order.payments[0]?.gatewayPaymentId ?? null
    // Refunded from the account that took it, whichever is switched on now.
    const paymentMode = modeOfPayment(order.payments[0]?.mode, await paymentConfig())

    // CANCELLED qualifies only while it still holds captured money: orders
    // cancelled while paid, before cancel stopped accepting them, and anything
    // a payment landed on after it was cancelled.
    const refundable: OrderStatus[] = [
      "PAID",
      "PACKED",
      "SHIPPED",
      "DELIVERED",
      "RETURNED",
      ...(paymentId ? (["CANCELLED"] as OrderStatus[]) : []),
    ]
    if (!refundable.includes(order.status)) {
      return fail("That order cannot be refunded.", undefined, 409)
    }

    // Claimed on the exact status read above, so the restock decision below
    // is made on the state this refund actually moved the order out of.
    const claimed = await db.order.updateMany({
      where: { id, status: order.status },
      data: { status: "REFUNDED" },
    })
    if (claimed.count === 0)
      return fail("That order changed just now. Reload and try again.", undefined, 409)

    if (paymentId) {
      try {
        await refundPayment({
          gatewayPaymentId: paymentId,
          amountRupees: order.total.toString(),
          mode: paymentMode,
        })
      } catch (err) {
        // The order was marked REFUNDED before the money moved, and a refusal
        // used to leave it there: refunded on screen, never refunded in fact,
        // and no longer offering the button to try again. Put it back.
        await db.order.updateMany({
          where: { id, status: "REFUNDED" },
          data: { status: order.status },
        })
        console.error("[REFUND] gateway refused", id, err)
        return fail(
          "Razorpay did not issue the refund, so the order is unchanged. Try again, or refund it from the Razorpay dashboard.",
          undefined,
          502,
        )
      }
      await db.payment.updateMany({
        where: { orderId: id, status: "CAPTURED" },
        data: { status: "REFUNDED" },
      })
    }

    if (UNSHIPPED.includes(order.status) && order.items.length > 0) {
      await db.$transaction(
        order.items.map((item) =>
          db.variant.update({
            where: { id: item.variantId },
            data: { stock: { increment: item.qty } },
          }),
        ),
      )
    }

    // Still on our shelf, so call off the courier and the Shiprocket order.
    if (UNSHIPPED.includes(order.status)) await cancelShiprocketOrder(id, session)

    await createAuditLog(session, {
      action: "order:refund",
      module: "order",
      entityId: id,
      meta: {
        amount: order.total.toString(),
        gateway: Boolean(paymentId),
        from: order.status,
        restocked: UNSHIPPED.includes(order.status),
      },
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

    // Date.UTC, never new Date(y, m, d) - that is local midnight and shifts (§6).
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
