import { z } from "zod"

import { FEE_BASES, type FeeBasis } from "@/lib/config/shipping"

/**
 * Console-editable settings; client-safe, the forms validate with these. In every input a field
 * left out is unchanged, and an empty string clears the saved value so .env applies again.
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

export const WEBHOOK_TOKEN_MIN = 32

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
  // The only guard against a forged "delivered" update, so it must be too long to guess.
  webhookToken: secret
    .refine((v) => v === "" || v.length >= WEBHOOK_TOKEN_MIN, {
      message: `Use at least ${WEBHOOK_TOKEN_MIN} characters - openssl rand -hex 24 makes one`,
    })
    .optional(),
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
  sharePercent: z.coerce
    .number({ error: "Enter a percentage" })
    .int("The share is a whole percentage")
    .min(0, "The share cannot be negative")
    .max(100, "The share is at most 100%"),
  basis: z.enum(FEE_BASES),
})
export type ShippingCharge = z.infer<typeof shippingChargeSchema>

export const testPaymentSchema = z.strictObject({ mode: z.enum(PAYMENT_MODES) })

// ── paying on delivery ──────────────────────────────────────

/** "staff": only signed-in staff get it at checkout, to test live; storefront copy unchanged. */
export const OFFERS = ["off", "staff", "everyone"] as const
export type Offer = (typeof OFFERS)[number]

export const OFFER_LABEL: Record<Offer, string> = {
  off: "Off",
  staff: "Staff only, to test",
  everyone: "Everyone",
}

/** A share of the order's total, or a fixed amount. */
export const ADVANCE_KINDS = ["PERCENT", "FLAT"] as const
export type AdvanceKind = (typeof ADVANCE_KINDS)[number]

// Past this share an advance is simply paying online.
export const ADVANCE_PERCENT_MAX = 95

const charge = (label: string) =>
  z.coerce
    .number({ error: `Enter ${label} in rupees` })
    .int(`${label} is a whole number of rupees`)
    .min(0, `${label} cannot be negative`)
    .max(5_000, `${label} is at most ₹5,000`)

/** COD, and an advance online with the rest on delivery. Paying in full online is always free. */
export const paymentOptionsSchema = z.strictObject({
  cod: z.strictObject({
    offer: z.enum(OFFERS),
    feeRupees: charge("The cash-on-delivery charge"),
  }),
  partial: z
    .strictObject({
      offer: z.enum(OFFERS),
      feeRupees: charge("The charge"),
      advanceKind: z.enum(ADVANCE_KINDS),
      advanceValue: z.coerce
        .number({ error: "Enter the advance" })
        .int("The advance is a whole number")
        .min(1, "The advance is at least 1")
        .max(100_000, "The advance is at most ₹1,00,000"),
    })
    .superRefine((input, ctx) => {
      if (input.advanceKind === "PERCENT" && input.advanceValue > ADVANCE_PERCENT_MAX) {
        ctx.addIssue({
          code: "custom",
          path: ["advanceValue"],
          message: `A percentage advance is at most ${ADVANCE_PERCENT_MAX}%`,
        })
      }
    }),
})
export type PaymentOptions = z.infer<typeof paymentOptionsSchema>

// ── what the console is shown ────────────────────────────────

export type SettingSource = "saved" | "env" | null

export type ValueState = { value: string | null; source: SettingSource }

/** A secret is never sent to the browser: only whether it is set, and its last four characters. */
export type SecretState = {
  set: boolean
  source: SettingSource
  hint: string | null
  /** Saved but will not decrypt (AUTH_SECRET changed); must be entered again. */
  unreadable: boolean
}

export type KeySetView = {
  keyId: ValueState
  keySecret: SecretState
  webhookSecret: SecretState
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
  checkout: PaymentOptions & { source: "saved" | "default" }
  /** Last save per section (null: never). Sent back as `version`; a stale save is refused. */
  versions: SettingVersions
  canWrite: boolean
}

export type SettingVersions = Record<
  "payment" | "shiprocket" | "shipping" | "checkout",
  string | null
>
