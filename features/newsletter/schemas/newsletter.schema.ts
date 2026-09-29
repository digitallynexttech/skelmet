import { z } from "zod"

import { newsletterDocSchema } from "@/features/newsletter/newsletter-content"

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
  /** The rich-text editor's document; see newsletter-content.ts for what it may hold. */
  content: newsletterDocSchema,
  ctaLabel: z.string().trim().max(40).optional().or(z.literal("")),
  ctaUrl: z
    .url({ protocol: /^https?$/, error: "Use a full link, starting https://" })
    .optional()
    .or(z.literal("")),
  /** Only to the staff member sending it, to see it in a real inbox first. */
  test: z.boolean().default(false),
})

export type SendCampaignInput = z.input<typeof sendCampaignSchema>

/** What an uploaded picture may be before it is resized: a phone photo fits. */
export const NEWSLETTER_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]
/** Under the 10 MB Next buffers behind the proxy; past it the body is cut short. */
export const NEWSLETTER_IMAGE_MAX_BYTES = 8 * 1024 * 1024
