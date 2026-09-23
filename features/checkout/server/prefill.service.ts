import "server-only"

import { rememberedOrder } from "@/features/checkout/server/recent-order"
import { hasDatabase } from "@/lib/env"
import { fail, ok, runAction, type ActionResult } from "@/server/action-result"
import { db } from "@/server/db"

/**
 * Fills in a returning buyer's details at checkout.
 *
 * Authorised by the httpOnly `skm.recent-order` cookie — the same proof the
 * confirmation page uses — and by NOTHING the visitor types.
 *
 * That constraint is the whole design. The obvious version of this feature is
 * "type an email, get the saved address back", and it cannot be built safely:
 * with no account to sign in to, an email address is not a secret, so that
 * endpoint would hand anyone the home address and phone number of any customer
 * whose email they could guess — every address in the shop, readable from the
 * checkout form, one address at a time. A cookie cannot be guessed, so this
 * only ever answers the browser that actually placed the order.
 *
 * What it gives up: someone buying again from a different device, or after
 * clearing cookies, types their address again. What it avoids is turning
 * checkout into a lookup service for other people's addresses.
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
    // A cookie naming an order that no longer exists is not worth explaining;
    // an empty prefill is the same outcome as never having ordered.
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
