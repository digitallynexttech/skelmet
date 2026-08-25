import { z } from "zod"

export const addressSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(60),
  lastName: z.string().trim().min(1, "Last name is required").max(60),
  line1: z.string().trim().min(4, "Address is required").max(160),
  line2: z.string().trim().max(160).optional().or(z.literal("")),
  city: z.string().trim().min(2, "City is required").max(80),
  state: z.string().trim().min(2, "State is required").max(80),
  pincode: z.string().trim().regex(/^[1-9][0-9]{5}$/, "Enter a valid 6-digit pincode"),
})

export const placeOrderSchema = z.object({
  email: z.email("That email doesn't look right"),
  phone: z
    .string()
    .trim()
    .regex(/^(\+91[- ]?)?[6-9]\d{9}$/, "Enter a valid Indian mobile number"),
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
  paymentMethod: z.enum(["ONLINE", "COD"]).default("ONLINE"),
  saveAddress: z.boolean().default(false),
  giftNote: z.boolean().default(false),
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
