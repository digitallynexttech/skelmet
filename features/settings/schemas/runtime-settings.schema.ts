import { z } from "zod"

import { FEE_BASES, type FeeBasis } from "@/config/shipping"

/**
 * The settings the console changes without a deploy: which Razorpay account
 * takes payments and its keys, the Shiprocket login, and the shipping charge.
 * Client-safe: the forms validate with these too.
 *
 * In every input, a field left out is left as it is, and an empty string
 * clears what was saved, so that value comes from .env again.
 */

export const PAYMENT_MODES = ["test", "live"] as const
export type PaymentMode = (typeof PAYMENT_MODES)[number]

/** Razorpay puts the account in the key id, so a key pasted into the wrong slot is caught. */
export const KEY_PREFIX: Record<PaymentMode, string> = {
  test: "rzp_test_",
  live: "rzp_live_",
}

export const FEE_BASIS_LABEL: Record<FeeBasis, string> = {
  twoCheapest: "Mean of the two cheapest couriers",
  average: "Average of every courier offered",
  cheapest: "Cheapest courier",
  recommended: "Shiprocket's recommended courier",
}

const secret = z.string().trim().max(500)

const keySetSchema = z.strictObject({
  keyId: z.string().trim().max(100).optional(),
  keySecret: secret.optional(),
  webhookSecret: secret.optional(),
})

export const paymentSettingsSchema = z
  .strictObject({
    mode: z.enum(PAYMENT_MODES).optional(),
    test: keySetSchema.optional(),
    live: keySetSchema.optional(),
  })
  .superRefine((input, ctx) => {
    for (const mode of PAYMENT_MODES) {
      const keyId = input[mode]?.keyId
      if (keyId && !keyId.startsWith(KEY_PREFIX[mode])) {
        ctx.addIssue({
          code: "custom",
          path: [mode, "keyId"],
          message: `A ${mode} key id starts with ${KEY_PREFIX[mode]}`,
        })
      }
    }
  })
export type PaymentSettingsInput = z.infer<typeof paymentSettingsSchema>

export const shiprocketSettingsSchema = z.strictObject({
  email: z
    .string()
    .trim()
    .max(200)
    .refine((v) => v === "" || z.email().safeParse(v).success, "Enter the API user's email")
    .optional(),
  password: secret.optional(),
  pickupLocation: z.string().trim().max(100).optional(),
  webhookToken: secret.optional(),
})
export type ShiprocketSettingsInput = z.infer<typeof shiprocketSettingsSchema>

const rupees = (label: string) =>
  z.coerce
    .number({ error: `Enter ${label} in rupees` })
    .int(`${label} is a whole number of rupees`)
    .min(0, `${label} cannot be negative`)
    .max(100_000, `${label} is at most ₹1,00,000`)

export const shippingChargeSchema = z.strictObject({
  aboveRupees: rupees("The courier cost"),
  feeRupees: rupees("The charge"),
  basis: z.enum(FEE_BASES),
})
export type ShippingCharge = z.infer<typeof shippingChargeSchema>

export const testPaymentSchema = z.strictObject({ mode: z.enum(PAYMENT_MODES) })

// ── what the console is shown ────────────────────────────────

/** Where a value in use comes from. */
export type SettingSource = "saved" | "env" | null

export type ValueState = { value: string | null; source: SettingSource }

/** A secret is never sent to the browser: only whether it is set, and its last four characters. */
export type SecretState = {
  set: boolean
  source: SettingSource
  hint: string | null
  /** Saved, but it will not decrypt - AUTH_SECRET changed. It has to be entered again. */
  unreadable: boolean
}

export type KeySetView = {
  keyId: ValueState
  keySecret: SecretState
  webhookSecret: SecretState
  /** A key id and secret are both in place, so this account can take payments. */
  ready: boolean
}

export type RuntimeSettingsView = {
  payment: {
    mode: PaymentMode
    modeSource: "saved" | "env" | "default"
    test: KeySetView
    live: KeySetView
    webhookUrl: string
  }
  shiprocket: {
    email: ValueState
    password: SecretState
    pickupLocation: ValueState
    webhookToken: SecretState
    webhookUrl: string
    ready: boolean
  }
  shipping: ShippingCharge & { source: "saved" | "default" }
  canWrite: boolean
}
