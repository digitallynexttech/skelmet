import { z } from "zod"

/** Both required: a number alone is guessable; the email proves ownership. */
export const trackOrderSchema = z.object({
  orderNumber: z
    .string()
    .trim()
    .min(1, "Enter your order number")
    .max(40)
    .transform((v) => v.toUpperCase()),
  email: z.email("Use the email you ordered with"),
})

export type TrackOrderInput = z.infer<typeof trackOrderSchema>
