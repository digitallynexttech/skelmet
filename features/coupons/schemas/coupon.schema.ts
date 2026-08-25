import { z } from "zod"

export const createCouponSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9-]{3,24}$/, "Letters, numbers and dashes only, 3 to 24 characters"),
    kind: z.enum(["PERCENT", "FLAT"]),
    value: z.coerce.number().positive("Must be more than zero"),
    minSubtotal: z.coerce.number().min(0).default(0),
    maxUses: z.coerce.number().int().positive().nullable().optional(),
    expiresAt: z.coerce.date().nullable().optional(),
  })
  .refine((c) => c.kind !== "PERCENT" || c.value <= 90, {
    message: "A percent discount above 90% is almost always a typo",
    path: ["value"],
  })

export const updateCouponSchema = z.object({
  kind: z.enum(["PERCENT", "FLAT"]).optional(),
  value: z.coerce.number().positive().optional(),
  minSubtotal: z.coerce.number().min(0).optional(),
  maxUses: z.coerce.number().int().positive().nullable().optional(),
  expiresAt: z.coerce.date().nullable().optional(),
})

export const validateCouponSchema = z.object({
  code: z.string().trim().toUpperCase().min(1, "Enter a code"),
  subtotal: z.coerce.number().min(0),
})

export type CreateCouponInput = z.infer<typeof createCouponSchema>
export type UpdateCouponInput = z.infer<typeof updateCouponSchema>
