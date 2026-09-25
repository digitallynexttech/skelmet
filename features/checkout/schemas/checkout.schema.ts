import { z } from "zod"

import { INDIAN_STATES } from "@/lib/india"

/**
 * The form checks these as the buyer types and the server checks them again,
 * from this one file, so the two cannot drift apart. Each rule that can fail
 * for more than one reason is split, so the message names the actual problem.
 */
export const addressSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(60),
  lastName: z.string().trim().min(1, "Last name is required").max(60),
  line1: z.string().trim().min(4, "Address is required").max(160),
  line2: z.string().trim().max(160).optional().or(z.literal("")),
  city: z
    .string()
    .trim()
    .min(2, "City is required")
    .max(80)
    .regex(/^[\p{L}][\p{L} .'()&-]*$/u, "Use letters only for the city"),
  state: z.enum(INDIAN_STATES, { error: "Choose your state" }),
  // abort: a value that is not six digits gets that message alone, not a
  // second one about its first digit as well.
  pincode: z
    .string()
    .trim()
    .regex(/^\d{6}$/, { error: "Enter your 6-digit pincode", abort: true })
    .regex(/^[1-9]/, "A pincode never starts with 0"),
})

export const placeOrderSchema = z.object({
  email: z.email("That email doesn't look right"),
  // Exactly ten digits, as couriers dial it: no +91, no leading 0, no spaces.
  // The field strips those as they are typed, so this only ever meets them
  // from a hand-made request.
  phone: z
    .string()
    .trim()
    .regex(/^\d{10}$/, {
      error: "Enter your 10-digit mobile number, without +91 or 0",
      abort: true,
    })
    .regex(/^[6-9]/, "Indian mobile numbers start with 6, 7, 8 or 9"),
  address: addressSchema,
  items: z
    .array(
      z.object({
        sku: z.string().trim().min(1),
        qty: z.number().int().min(1).max(9),
      }),
    )
    .min(1, "Your cart is empty")
    .max(20),
  couponCode: z.string().trim().max(40).optional().or(z.literal("")),
  /**
   * Cash on delivery is not offered. This is a literal rather than a narrowed
   * enum so the refusal lives at the boundary: hiding the button alone would
   * still let a hand-made request place an order that never pays.
   *
   * PaymentMethod in the schema keeps COD, because orders already placed with
   * it still have to pack, ship and display.
   */
  paymentMethod: z.literal("ONLINE").default("ONLINE"),
  saveAddress: z.boolean().default(false),
})

export const verifyPaymentSchema = z.object({
  orderId: z.uuid(),
  gatewayOrderId: z.string().trim().min(1),
  gatewayPaymentId: z.string().trim().min(1),
  signature: z.string().trim().min(1),
})

export type AddressInput = z.infer<typeof addressSchema>
export type PlaceOrderInput = z.infer<typeof placeOrderSchema>
export type VerifyPaymentInput = z.infer<typeof verifyPaymentSchema>
