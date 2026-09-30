import "server-only"

import { z } from "zod"

import {
  advanceOf,
  methodFee,
  offered,
  type Advance,
  type PaymentMethod,
} from "@/features/checkout/payment-options"
import type { PaymentOptions } from "@/features/settings/schemas/runtime-settings.schema"
import { paymentOptions } from "@/features/settings/server/runtime-settings"
import { collectsOnDelivery } from "@/features/shipping/server/shipping.service"
import { ok, runAction, type ActionResult } from "@/server/action-result"
import { staffSession } from "@/server/action-guard"

/**
 * The ways to pay this buyer is offered at checkout.
 *
 * Paying online is always there. Cash on delivery and the advance are there
 * when the console has switched them on (Settings > Pay on delivery) - for
 * everyone, or only for a signed-in member of staff while they are being
 * tried on the live site. placeOrder asks the same question again, so a
 * hand-made request cannot choose a way of paying it was never shown.
 */

export type OfferedMethod = {
  id: PaymentMethod
  /** What paying this way adds to the order, rupees. */
  fee: number
  /** PARTIAL only: how much of the order is paid now. */
  advance: Advance | null
  /** False when no courier collects payment at the pincode asked about. */
  available: boolean
  /** On test: offered to this viewer because they are signed in to the console. */
  staffOnly: boolean
}

export type CheckoutOptions = { methods: OfferedMethod[] }

const optionsSchema = z.object({
  /** Left out until the buyer has typed one; nothing is then ruled out by it. */
  pincode: z
    .string()
    .trim()
    .regex(/^[1-9][0-9]{5}$/)
    .optional()
    .catch(undefined),
  units: z.coerce.number().int().min(1).max(180).catch(1),
})

/** A current member of staff, read fresh: a revoked login previews nothing. */
export async function viewerIsStaff(): Promise<boolean> {
  try {
    return (await staffSession())?.user.kind === "STAFF"
  } catch {
    return false
  }
}

/** Whether staff need telling apart at all - only while something is on test. */
function onTest(options: PaymentOptions): boolean {
  return options.cod.offer === "staff" || options.partial.offer === "staff"
}

/**
 * The options in force and what this viewer may choose from them. Online
 * first, then the advance, then cash on delivery: most paid now to least.
 */
export async function offeredMethods(): Promise<{
  options: PaymentOptions
  methods: Omit<OfferedMethod, "available">[]
}> {
  const options = await paymentOptions()
  const staff = onTest(options) ? await viewerIsStaff() : false

  const methods: Omit<OfferedMethod, "available">[] = [
    { id: "ONLINE", fee: 0, advance: null, staffOnly: false },
  ]
  if (offered(options.partial.offer, staff)) {
    methods.push({
      id: "PARTIAL",
      fee: methodFee(options, "PARTIAL"),
      advance: advanceOf(options),
      staffOnly: options.partial.offer === "staff",
    })
  }
  if (offered(options.cod.offer, staff)) {
    methods.push({
      id: "COD",
      fee: methodFee(options, "COD"),
      advance: null,
      staffOnly: options.cod.offer === "staff",
    })
  }
  return { options, methods }
}

export async function getCheckoutOptions(raw: unknown): Promise<ActionResult<CheckoutOptions>> {
  return runAction(async () => {
    const { pincode, units } = optionsSchema.parse(raw)
    const { methods } = await offeredMethods()

    // Shiprocket is only asked when something is collected at the door.
    const collects =
      pincode && methods.some((m) => m.id !== "ONLINE")
        ? await collectsOnDelivery(pincode, units)
        : null

    return ok({
      methods: methods.map((m) => ({
        ...m,
        available: m.id === "ONLINE" || collects !== false,
      })),
    })
  })
}
