import "server-only"

import { rememberedOrder } from "@/features/checkout/server/recent-order"
import { hasDatabase } from "@/lib/env"
import { fail, ok, runAction, type ActionResult } from "@/server/action-result"
import { db } from "@/server/db"

/**
 * A returning buyer's details at checkout, authorised only by the signed
 * `skm.recent-order` cookie and by nothing the visitor types. Never look up by
 * email: with no accounts, an email is not a secret and would leak addresses.
 */
export type CheckoutPrefill = {
  email: string
  phone: string
  address: {
    firstName: string
    lastName: string
    line1: string
    line2: string
    city: string
    state: string
    pincode: string
  }
}

export async function getCheckoutPrefill(): Promise<ActionResult<CheckoutPrefill | null>> {
  return runAction(async () => {
    if (!hasDatabase()) return ok(null)

    const number = await rememberedOrder()
    if (!number) return ok(null)

    const order = await db.order.findUnique({
      where: { number },
      select: { email: true, phone: true, shippingAddress: true },
    })
    if (!order) return ok(null)

    const a = order.shippingAddress as Record<string, unknown> | null
    if (!a || typeof a !== "object") return fail("No saved address.", undefined, 404)

    const str = (k: string) => (typeof a[k] === "string" ? (a[k] as string) : "")

    return ok({
      email: order.email,
      phone: order.phone,
      address: {
        firstName: str("firstName"),
        lastName: str("lastName"),
        line1: str("line1"),
        line2: str("line2"),
        city: str("city"),
        state: str("state"),
        pincode: str("pincode"),
      },
    })
  })
}
