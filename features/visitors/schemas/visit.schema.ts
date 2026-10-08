import { z } from "zod"

// `sid` is the tab's visit id. With `consent: false` the server keeps no cookie,
// IP address or contact details.

const common = {
  sid: z.uuid(),
  consent: z.boolean(),
}

const deviceSchema = z.object({
  /** "412x915", CSS pixels. */
  screen: z.string().max(20).optional(),
  lang: z.string().max(35).optional(),
  tz: z.string().max(60).optional(),
  touch: z.number().int().min(0).max(32).optional(),
  model: z.string().max(60).optional(),
  platformVersion: z.string().max(30).optional(),
})

const lineSchema = z.object({
  sku: z.string().trim().min(1).max(60),
  qty: z.number().int().min(1).max(9),
})

export const visitSchema = z.discriminatedUnion("t", [
  /** `pv` is the view's id, so time can be added to it later. */
  z.object({
    ...common,
    t: z.literal("view"),
    pv: z.uuid(),
    path: z.string().min(1).max(600),
    /** First page only. */
    ref: z.string().max(1000).optional(),
    device: deviceSchema.optional(),
  }),
  /** Seconds since the last report. */
  z.object({
    ...common,
    t: z.literal("time"),
    pv: z.uuid(),
    s: z.number().int().min(1).max(1800),
  }),
  z.object({
    ...common,
    t: z.literal("cart"),
    items: z.array(lineSchema).max(20),
    checkout: z.boolean().optional(),
  }),
  /** Typed at checkout. Kept only with consent. */
  z.object({
    ...common,
    t: z.literal("contact"),
    email: z.email().max(254).optional(),
    phone: z
      .string()
      .regex(/^[6-9]\d{9}$/)
      .optional(),
    name: z.string().trim().min(1).max(120).optional(),
    pincode: z
      .string()
      .regex(/^[1-9]\d{5}$/)
      .optional(),
  }),
  z.object({
    ...common,
    t: z.literal("placed"),
    number: z.string().trim().max(40).optional(),
  }),
  /** `consent` carries the answer. */
  z.object({
    ...common,
    t: z.literal("consent"),
  }),
])

export type VisitInput = z.infer<typeof visitSchema>
