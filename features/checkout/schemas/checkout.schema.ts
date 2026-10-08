import { z } from "zod"

import { PAYMENT_METHODS } from "@/features/checkout/payment-options"
import { INDIAN_STATES } from "@/lib/india"

/**
 * Shared by the form and the server so they cannot drift. Rules are split so
 * each message names the actual problem.
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
  // abort: one message, not a second about the first digit.
  pincode: z
    .string()
    .trim()
    .regex(/^\d{6}$/, { error: "Enter your 6-digit pincode", abort: true })
    .regex(/^[1-9]/, "A pincode never starts with 0"),
})

export const placeOrderSchema = z.object({
  email: z.email("That email doesn't look right"),
  // Ten digits as couriers dial it: no +91, leading 0 or spaces.
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
  /** What exists only; placeOrder checks what this buyer is offered. */
  paymentMethod: z.enum(PAYMENT_METHODS).default("ONLINE"),
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
