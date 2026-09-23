import { z } from "zod"

/**
 * Both fields are required together on purpose. An order number alone is a
 * short, guessable key — the email is what turns a lookup into a claim of
 * ownership. The same schema validates the form and the service (§6).
 */
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
