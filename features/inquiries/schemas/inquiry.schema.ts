import { z } from "zod"

/** The same schema validates the form (zodResolver) and the service (§6). */
export const createInquirySchema = z.object({
  name: z.string().trim().min(2, "Tell us your name").max(80),
  email: z.email("That email doesn't look right"),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  topic: z.string().trim().min(2).max(60),
  orderNumber: z.string().trim().max(40).optional().or(z.literal("")),
  message: z.string().trim().min(10, "A little more detail helps").max(4000),
  /** Honeypot: bots fill it, humans never see it. */
  website: z.string().max(0).optional(),
})

export type CreateInquiryInput = z.infer<typeof createInquirySchema>
