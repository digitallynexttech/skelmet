import "server-only"

import type { PaymentMethod } from "@/features/checkout/payment-options"
import { trackOrderSchema } from "@/features/orders/schemas/track.schema"
import { trackingUrl } from "@/features/shipping/server/shiprocket-mapping"
import { hasDatabase } from "@/lib/env"
import { rateLimit } from "@/lib/rate-limit"
import { fail, ok, runAction, type ActionResult } from "@/server/action-result"
import { db } from "@/server/db"

/**
 * Public lookup: no `requirePermission`, the number plus email is the whole
 * credential. So every miss gets one answer, the email is never returned, and no
 * address, phone or payment ids go out.
 */
export type TrackedOrder = {
  number: string
  status: string
  paymentMethod: PaymentMethod
  /** "0" when all paid online. */
  dueOnDelivery: string
  placedAt: string | null
  itemCount: number
  items: { name: string; qty: number }[]
  courier: string | null
  awb: string | null
  /** e.g. "IN TRANSIT". */
  courierStatus: string | null
  etd: string | null
  /** Shiprocket shipments only. */
  trackingUrl: string | null
  shippedAt: string | null
  deliveredAt: string | null
}

export async function trackOrder(raw: unknown): Promise<ActionResult<TrackedOrder>> {
  return runAction(async () => {
    const input = trackOrderSchema.parse(raw)
    if (!hasDatabase()) return fail("Tracking is not available yet.", undefined, 503)

    // Per email too, so order numbers cannot be walked from many IPs. Same 429 for any email.
    rateLimit(`track-email:${input.email.trim().toLowerCase()}`, 10, 10 * 60_000)

    const order = await db.order.findUnique({
      where: { number: input.orderNumber },
      select: {
        number: true,
        email: true,
        status: true,
        paymentMethod: true,
        dueOnDelivery: true,
        placedAt: true,
        createdAt: true,
        items: { select: { nameSnapshot: true, qty: true } },
        shipment: {
          select: {
            courier: true,
            awb: true,
            status: true,
            provider: true,
            etd: true,
            shippedAt: true,
            deliveredAt: true,
          },
        },
      },
    })

    // One message for every miss, or it would confirm which numbers exist.
    const miss = fail("We could not find that order. Check the number and email.", undefined, 404)
    if (!order) return miss
    if (order.email.toLowerCase() !== input.email.toLowerCase()) return miss

    return ok({
      number: order.number,
      status: order.status,
      paymentMethod: order.paymentMethod,
      dueOnDelivery: order.dueOnDelivery.toString(),
      placedAt: (order.placedAt ?? order.createdAt).toISOString(),
      itemCount: order.items.reduce((sum, i) => sum + i.qty, 0),
      items: order.items.map((i) => ({ name: i.nameSnapshot, qty: i.qty })),
      courier: order.shipment?.courier ?? null,
      awb: order.shipment?.awb ?? null,
      courierStatus: order.shipment?.status ?? null,
      etd: order.shipment?.etd?.toISOString() ?? null,
      trackingUrl:
        order.shipment?.provider === "shiprocket" && order.shipment.awb
          ? trackingUrl(order.shipment.awb)
          : null,
      shippedAt: order.shipment?.shippedAt?.toISOString() ?? null,
      deliveredAt: order.shipment?.deliveredAt?.toISOString() ?? null,
    })
  })
}
