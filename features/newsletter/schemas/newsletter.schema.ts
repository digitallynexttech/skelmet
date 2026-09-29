import { z } from "zod"

/** The home page's "Notify me": an email address and nothing else. */
export const subscribeSchema = z.object({
  /** Trimmed first: a phone keyboard's autocomplete often leaves a space after it. */
  email: z.string().trim().max(254).pipe(z.email("That email doesn't look right")),
  /** Honeypot: bots fill it, humans never see it. */
  website: z.string().max(0).optional(),
})

export type SubscribeInput = z.infer<typeof subscribeSchema>

/** The secret in an unsubscribe link. The app's are 64 hex characters. */
export const unsubscribeSchema = z.object({
  token: z.string().trim().min(32).max(128),
})

/** The same schema validates the console's form and the service (§6). */
export const sendCampaignSchema = z.object({
  subject: z.string().trim().min(3, "Give it a subject").max(120),
  body: z.string().trim().min(10, "Write a little more").max(10_000),
  ctaLabel: z.string().trim().max(40).optional().or(z.literal("")),
  ctaUrl: z
    .url({ protocol: /^https?$/, error: "Use a full link, starting https://" })
    .optional()
    .or(z.literal("")),
  /** Only to the staff member sending it, to see it in a real inbox first. */
  test: z.boolean().default(false),
})

export type SendCampaignInput = z.input<typeof sendCampaignSchema>
