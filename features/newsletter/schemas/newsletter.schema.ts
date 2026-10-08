import { z } from "zod"

import { newsletterDocSchema } from "@/features/newsletter/newsletter-content"

export const subscribeSchema = z.object({
  /** Trimmed first: phone autocomplete often leaves a trailing space. */
  email: z.string().trim().max(254).pipe(z.email("That email doesn't look right")),
  /** Honeypot: bots fill it, humans never see it. */
  website: z.string().max(0).optional(),
})

export type SubscribeInput = z.infer<typeof subscribeSchema>

/** The app issues 64 hex characters. */
export const unsubscribeSchema = z.object({
  token: z.string().trim().min(32).max(128),
})

/** Shared by the console form and the service. */
export const sendCampaignSchema = z.object({
  subject: z.string().trim().min(3, "Give it a subject").max(120),
  content: newsletterDocSchema,
  ctaLabel: z.string().trim().max(40).optional().or(z.literal("")),
  ctaUrl: z
    .url({ protocol: /^https?$/, error: "Use a full link, starting https://" })
    .optional()
    .or(z.literal("")),
  /** Send only to the staff member sending it. */
  test: z.boolean().default(false),
})

export type SendCampaignInput = z.input<typeof sendCampaignSchema>

export const NEWSLETTER_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]
/** Under the 10 MB Next buffers behind the proxy; past it the body is cut short. */
export const NEWSLETTER_IMAGE_MAX_BYTES = 8 * 1024 * 1024
