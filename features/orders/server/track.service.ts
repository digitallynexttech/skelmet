import "server-only"

import { trackOrderSchema } from "@/features/orders/schemas/track.schema"
import { hasDatabase } from "@/lib/env"
import { fail, ok, runAction, type ActionResult } from "@/server/action-result"
import { db } from "@/server/db"

/**
 * Public order lookup, for the customer who is not signed in and is not on the
 * browser that placed the order — which is most people chasing a delivery.
 *
 * Deliberately has no `requirePermission`: this is the one order read a
 * stranger is allowed to make, and the number plus the email it was placed
 * with is the whole credential. That is weak on its own, so the route in front
 * of it rate-limits hard, and everything below is shaped to avoid leaking:
 *
 *  - A wrong number, a wrong email and an order that never existed all get the
 *    same answer, so this cannot be used to discover which numbers are real.
 *  - The email is compared, never returned. Nothing here echoes a field the
 *    caller did not already supply.
 *  - No address, no phone, no payment identifiers — a courier status is all
 *    anyone needs from this screen.
 */
export type TrackedOrder = {
  number: string
  status: string
  paymentMethod: "ONLINE" | "COD"
  placedAt: string | null
  itemCount: number
  items: { name: string; qty: number }[]
  courier: string | null
  awb: string | null
  shippedAt: string | null
  deliveredAt: string | null
}

export async function trackOrder(raw: unknown): Promise<ActionResult<TrackedOrder>> {
  return runAction(async () => {
    const input = trackOrderSchema.parse(raw)
    if (!hasDatabase()) return fail("Tracking is not available yet.", undefined, 503)

    const order = await db.order.findUnique({
      where: { number: input.orderNumber },
      select: {
        number: true,
        email: true,
        status: true,
        paymentMethod: true,
        placedAt: true,
        createdAt: true,
        items: { select: { nameSnapshot: true, qty: true } },
        shipment: {
          select: { courier: true, awb: true, shippedAt: true, deliveredAt: true },
        },
      },
    })

    // One message for every miss. Splitting these into "no such order" and
    // "wrong email" would confirm which numbers exist, one guess at a time.
    const miss = fail("We could not find that order. Check the number and email.", undefined, 404)
    if (!order) return miss
    if (order.email.toLowerCase() !== input.email.toLowerCase()) return miss

    return ok({
      number: order.number,
      status: order.status,
      paymentMethod: order.paymentMethod,
      placedAt: (order.placedAt ?? order.createdAt).toISOString(),
      itemCount: order.items.reduce((sum, i) => sum + i.qty, 0),
      items: order.items.map((i) => ({ name: i.nameSnapshot, qty: i.qty })),
      courier: order.shipment?.courier ?? null,
      awb: order.shipment?.awb ?? null,
      shippedAt: order.shipment?.shippedAt?.toISOString() ?? null,
      deliveredAt: order.shipment?.deliveredAt?.toISOString() ?? null,
    })
  })
}
