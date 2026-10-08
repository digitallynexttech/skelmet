import "server-only"

import type { PaymentMethod } from "@/features/checkout/payment-options"
import { releaseStaleOrders } from "@/features/checkout/server/checkout.service"
import { creditNoteOnRefund, queueInvoiceEmail } from "@/features/invoices/server/invoice.service"
import { modeOfPayment, refundPayment } from "@/features/checkout/server/payment-gateway"
import { paymentConfig, type PaymentConfig } from "@/features/settings/server/runtime-settings"
import {
  deliveryState,
  fulfilmentState,
  paymentState,
  type DeliveryState,
  type FulfilmentState,
  type PaymentState,
} from "@/features/orders/order-progress"
import { ORDER_VIEW_KEYS, isInView, viewWhere, type OrderView } from "@/features/orders/order-views"
import { cancelledByStaff } from "@/features/orders/server/cancellations"
import { moneyModes } from "@/features/orders/server/test-order-rules"
import { manualShipmentSchema } from "@/features/shipping/schemas/shipping.schema"
import { isShiprocketConfigured } from "@/features/shipping/server/shiprocket"
import { trackingStage, trackingUrl } from "@/features/shipping/server/shiprocket-mapping"
import { cancelShiprocketOrder, notifyShipped } from "@/features/shipping/server/shipping.service"
import { paginate } from "@/lib/api-response"
import {
  MAX_PAGE_SIZE,
  ORDER_STATUSES,
  PAGE_SIZE,
  PAID_ORDER_STATUSES,
  PERMISSIONS,
  statusesIn,
  type OrderScope,
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
  dueOnDelivery: true,
  createdAt: true,
  placedAt: true,
  shippingAddress: true,
  shipment: { select: { status: true, pickupScheduledAt: true } },
  payments: { select: { status: true, mode: true } },
  _count: { select: { items: true } },
} as const

export type OrderRow = {
  id: string
  number: string
  status: OrderStatus
  paymentMethod: PaymentMethod
  email: string
  phone: string
  total: string
  /** What the courier still collects: the total for COD, the balance for PARTIAL. */
  dueOnDelivery: string
  itemCount: number
  customer: string
  location: string
  payment: PaymentState
  fulfilment: FulfilmentState
  delivery: DeliveryState | null
  /** Paid through Razorpay's test account. */
  testPayment: boolean
  createdAt: string
  placedAt: string | null
}

type RowContext = { byStaff: ReadonlySet<string>; payments: PaymentConfig }

type Address = { firstName?: string; lastName?: string; city?: string; state?: string }

const cancelledIds = (rows: Array<{ id: string; status: string }>) =>
  rows.filter((r) => r.status === "CANCELLED").map((r) => r.id)

function readAddress(json: unknown): Address {
  return (json ?? {}) as Address
}

function serializeRow(
  row: {
    id: string
    number: string
    status: string
    paymentMethod: string
    email: string
    phone: string
    total: { toString(): string }
    dueOnDelivery: { toString(): string }
    createdAt: Date
    placedAt: Date | null
    shippingAddress: unknown
    shipment: { status: string; pickupScheduledAt: Date | null } | null
    payments: Array<{ status: string; mode: string | null }>
    _count: { items: number }
  },
  { byStaff, payments }: RowContext,
): OrderRow {
  const addr = readAddress(row.shippingAddress)
  const modes = moneyModes(row.payments, payments)
  const status = row.status as OrderStatus
  const stage = row.shipment ? trackingStage(row.shipment.status) : null
  return {
    id: row.id,
    number: row.number,
    status: row.status as OrderStatus,
    paymentMethod: row.paymentMethod as PaymentMethod,
    email: row.email,
    phone: row.phone,
    total: row.total.toString(),
    dueOnDelivery: row.dueOnDelivery.toString(),
    itemCount: row._count.items,
    customer: [addr.firstName, addr.lastName].filter(Boolean).join(" ") || "Guest",
    location: [addr.city, addr.state].filter(Boolean).join(", ") || "-",
    payment: paymentState(status, row.paymentMethod as PaymentMethod),
    fulfilment: fulfilmentState(status, {
      shipped: stage !== null && stage !== "cancelled",
      cancelledByStaff: byStaff.has(row.id),
    }),
    delivery: deliveryState({
      orderStatus: status,
      courierStatus: row.shipment?.status ?? null,
      stage,
      pickupScheduled: row.shipment?.pickupScheduledAt != null,
    }),
    testPayment: modes.length > 0 && modes.every((m) => m === "test"),
    createdAt: row.createdAt.toISOString(),
    placedAt: row.placedAt?.toISOString() ?? null,
  }
}

/** Admin order queue. `scope` bounds everything; view and status narrow within it. */
export async function listOrders(params: {
  page?: number
  pageSize?: number
  scope?: OrderScope
  status?: OrderStatus | "ALL"
  view?: OrderView
  q?: string | null
}): Promise<
  ActionResult<{
    data: OrderRow[]
    pagination: unknown
    counts: Record<OrderStatus, number>
    viewCounts: Record<OrderView, number>
    allCount: number
  }>
> {
  return runAction(async () => {
    await requirePermission(PERMISSIONS.ORDER_READ)
    if (!hasDatabase()) return fail("Database not configured.", undefined, 503)

    // So an abandoned checkout's order never shows as live.
    await releaseStaleOrders()

    const page = Math.max(1, params.page ?? 1)
    const size = Math.min(MAX_PAGE_SIZE, Math.max(1, params.pageSize ?? PAGE_SIZE))
    const q = params.q?.trim()

    // Search narrows the tab counts; view and status filter do not.
    const searched = q
      ? {
          OR: [
            { number: { contains: q, mode: "insensitive" as const } },
            { email: { contains: q, mode: "insensitive" as const } },
            { phone: { contains: q } },
          ],
        }
      : {}

    const inScope = statusesIn(params.scope ?? "paid")
    // A status outside the scope matches nothing rather than widening it.
    const status =
      params.status && params.status !== "ALL"
        ? { status: inScope.includes(params.status) ? params.status : { in: [] } }
        : { status: { in: [...inScope] } }
    const scoped = { ...searched, status: { in: [...inScope] } }
    // AND, not a spread: the search and a view are both an OR.
    const where = { AND: [searched, status, viewWhere(params.view ?? "all")] }

    const [rows, total, grouped] = await Promise.all([
      db.order.findMany({
        where,
        select: ORDER_LIST_SELECT,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * size,
        take: size,
      }),
      db.order.count({ where }),
      // By method too: the Unpaid tab depends on it.
      db.order.groupBy({
        by: ["status", "paymentMethod"],
        where: scoped,
        _count: { _all: true },
      }),
    ])

    // Every status and tab present, zeros included.
    const counts = Object.fromEntries(ORDER_STATUSES.map((s) => [s, 0])) as Record<
      OrderStatus,
      number
    >
    const viewCounts = Object.fromEntries(ORDER_VIEW_KEYS.map((v) => [v, 0])) as Record<
      OrderView,
      number
    >
    let all = 0
    for (const g of grouped) {
      const n = g._count._all
      const status = g.status as OrderStatus
      counts[status] += n
      all += n
      for (const view of ORDER_VIEW_KEYS) {
        if (isInView(view, status, g.paymentMethod as PaymentMethod)) viewCounts[view] += n
      }
    }

    const context = {
      byStaff: await cancelledByStaff(cancelledIds(rows)),
      payments: await paymentConfig(),
    }
    return ok({
      ...paginate(
        rows.map((row) => serializeRow(row, context)),
        page,
        size,
        total,
      ),
      counts,
      viewCounts,
      allCount: all,
    })
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
        paymentFee: true,
        tax: true,
        total: true,
        dueOnDelivery: true,
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
        creditNoteNumber: true,
        creditedAt: true,
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
      paymentFee: order.paymentFee.toString(),
      tax: order.tax.toString(),
      total: order.total.toString(),
      dueOnDelivery: order.dueOnDelivery.toString(),
      createdAt: order.createdAt.toISOString(),
      placedAt: order.placedAt?.toISOString() ?? null,
      invoicedAt: order.invoicedAt?.toISOString() ?? null,
      invoiceEmailedAt: order.invoiceEmailedAt?.toISOString() ?? null,
      creditedAt: order.creditedAt?.toISOString() ?? null,
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
      shiprocket: { configured: await isShiprocketConfigured(), orderId: order.shiprocketOrderId },
    })
  })
}

// An atomic updateMany claim, never PATCH { status }: two clicks at once must not both succeed.
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

// COD is packed unpaid (PENDING for older COD orders); an unpaid online order must never be packed.
export async function markPacked(id: string) {
  const order = await db.order.findUnique({
    where: { id },
    select: { paymentMethod: true },
  })

  const from: OrderStatus[] =
    order?.paymentMethod === "COD" ? ["PAID", "CONFIRMED", "PENDING"] : ["PAID", "CONFIRMED"]
  return transition(id, from, "PACKED", PERMISSIONS.ORDER_FULFIL, "order:pack")
}

/** Courier and AWB typed by hand. Validated before the claim, so SHIPPED always has a shipment. */
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

      // COD is paid, and counts as revenue, at the door.
      await db.order.updateMany({
        where: { id, paymentMethod: "COD", placedAt: null },
        data: { placedAt: new Date() },
      })
    },
  )
  if (result.ok) queueInvoiceEmail(id)
  return result
}

export async function cancelOrder(id: string) {
  // Unpaid orders only. A paid order goes through refundOrder, which returns the money.
  const result = await transition(
    id,
    ["PENDING", "CONFIRMED"],
    "CANCELLED",
    PERMISSIONS.ORDER_WRITE,
    "order:cancel",
    async () => {
      const order = await db.order.findUnique({
        where: { id },
        select: { couponId: true, items: { select: { variantId: true, qty: true } } },
      })
      if (!order) return

      // One transaction: the order is already CANCELLED, so a partial restock can't be replayed.
      await db.$transaction([
        ...order.items.map((item) =>
          db.variant.update({
            where: { id: item.variantId },
            data: { stock: { increment: item.qty } },
          }),
        ),
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
  // COD orders reach Shiprocket when placed.
  if (result.ok) await cancelShiprocketOrder(id, null)
  return result
}

/** Goods never left, so a refund restocks them. */
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
          select: { gatewayPaymentId: true, mode: true, amount: true },
          take: 1,
        },
      },
    })
    if (!order) return fail("Order not found.", undefined, 404)

    const paymentId = order.payments[0]?.gatewayPaymentId ?? null
    // Only what came through Razorpay (order or advance); courier cash is refunded outside it.
    const paidOnline = order.payments[0]?.amount.toString() ?? "0"
    // Refunded from the account that took it, whichever is switched on now.
    const paymentMode = modeOfPayment(order.payments[0]?.mode, await paymentConfig())

    // CANCELLED only while it still holds captured money.
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

    // Claimed on the exact status read, so the restock below decides on the state it left.
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
          amountRupees: paidOnline,
          mode: paymentMode,
        })
      } catch (err) {
        // Marked REFUNDED before the money moved: put it back so it can be retried.
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

    if (UNSHIPPED.includes(order.status)) await cancelShiprocketOrder(id, session)

    // Issues the credit note; the tax invoice can no longer be printed or emailed.
    await creditNoteOnRefund(id, session)

    await createAuditLog(session, {
      action: "order:refund",
      module: "order",
      entityId: id,
      meta: {
        amount: paymentId ? paidOnline : "0",
        total: order.total.toString(),
        gateway: Boolean(paymentId),
        from: order.status,
        restocked: UNSHIPPED.includes(order.status),
      },
      ...(await getAuditMeta()),
    })

    return ok({ id, status: "REFUNDED" as OrderStatus })
  })
}

const IST_OFFSET_MS = 5.5 * 60 * 60_000

/** Midnight IST as an instant: the shop's day is India's, not UTC's. */
export function startOfIndianDay(now: Date): Date {
  const ist = new Date(now.getTime() + IST_OFFSET_MS)
  return new Date(
    Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - IST_OFFSET_MS,
  )
}

export async function getDashboard(): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    await requirePermission(PERMISSIONS.DASHBOARD_READ)
    if (!hasDatabase()) return fail("Database not configured.", undefined, 503)

    const startOfToday = startOfIndianDay(new Date())
    const startOfWeek = new Date(startOfToday.getTime() - 6 * 86_400_000)

    const [todayCount, weekRevenue, awaiting, lowStock, recent] = await Promise.all([
      // Paid today, or COD accepted today (an order once placed, revenue only at the door).
      db.order.count({
        where: {
          OR: [
            {
              paymentMethod: { not: "COD" },
              placedAt: { gte: startOfToday },
              status: { in: [...PAID_ORDER_STATUSES] },
            },
            {
              paymentMethod: "COD",
              createdAt: { gte: startOfToday },
              status: { notIn: ["PENDING", "CANCELLED"] },
            },
          ],
        },
      }),
      db.order.aggregate({
        _sum: { total: true },
        where: { placedAt: { gte: startOfWeek }, status: { notIn: ["CANCELLED", "REFUNDED"] } },
      }),
      db.order.count({ where: { status: { in: ["CONFIRMED", "PAID", "PACKED"] } } }),
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

    const context = {
      byStaff: await cancelledByStaff(cancelledIds(recent)),
      payments: await paymentConfig(),
    }
    return ok({
      todayCount,
      weekRevenue: (weekRevenue._sum.total ?? 0).toString(),
      awaiting,
      lowStock,
      recent: recent.map((row) => serializeRow(row, context)),
    })
  })
}
