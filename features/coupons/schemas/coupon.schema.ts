import { z } from "zod"

/** Above this, a percent coupon is almost always a typo for a flat one. */
export const MAX_PERCENT_OFF = 90

export const PERCENT_TOO_HIGH = "A percent discount above 90% is almost always a typo"

/** The same rule for a new coupon and an edited one: a PERCENT coupon stays at or under 90. */
export function percentTooHigh(kind: "PERCENT" | "FLAT", value: number): boolean {
  return kind === "PERCENT" && value > MAX_PERCENT_OFF
}

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
    showInCart: z.boolean().default(false),
  })
  .refine((c) => !percentTooHigh(c.kind, c.value), { message: PERCENT_TOO_HIGH, path: ["value"] })

/**
 * An edit may send the kind, the value, both or neither. When it sends both
 * the rule is checked here; when it sends one, the service checks it against
 * the coupon's stored other half (updateCoupon), so switching a 95-rupee flat
 * coupon to PERCENT cannot slip past it either.
 */
export const updateCouponSchema = z
  .object({
    kind: z.enum(["PERCENT", "FLAT"]).optional(),
    value: z.coerce.number().positive("Must be more than zero").optional(),
    minSubtotal: z.coerce.number().min(0).optional(),
    maxUses: z.coerce.number().int().positive().nullable().optional(),
    expiresAt: z.coerce.date().nullable().optional(),
    showInCart: z.boolean().optional(),
  })
  .refine(
    (c) => c.kind === undefined || c.value === undefined || !percentTooHigh(c.kind, c.value),
    { message: PERCENT_TOO_HIGH, path: ["value"] },
  )

/**
 * Renewing a code: everything a new one takes except the code itself, which
 * is kept. The new expiry, if any, has to be still to come.
 */
export const renewCouponSchema = z
  .object({
    kind: z.enum(["PERCENT", "FLAT"]),
    value: z.coerce.number().positive("Must be more than zero"),
    minSubtotal: z.coerce.number().min(0).default(0),
    maxUses: z.coerce.number().int().positive().nullable().optional(),
    expiresAt: z.coerce
      .date()
      .refine((d) => d.getTime() > Date.now(), "Pick a date still to come, or leave it blank")
      .nullable()
      .optional(),
    showInCart: z.boolean().default(false),
  })
  .refine((c) => !percentTooHigh(c.kind, c.value), { message: PERCENT_TOO_HIGH, path: ["value"] })

export const validateCouponSchema = z.object({
  code: z.string().trim().toUpperCase().min(1, "Enter a code").max(40),
  subtotal: z.coerce.number().min(0),
})

export type CreateCouponInput = z.infer<typeof createCouponSchema>
export type UpdateCouponInput = z.infer<typeof updateCouponSchema>
