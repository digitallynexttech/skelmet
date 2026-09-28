import { z } from "zod"

/**
 * What the storefront's visit tracker sends to /api/public/visits.
 *
 * Every message names the visit (`sid`, the tab's own id for it) and says
 * whether the visitor has accepted cookies. That flag is the browser's own
 * record of their choice; the server only ever does less with a message that
 * says "not accepted" - no cookie, no IP address, no contact details.
 */

const common = {
  sid: z.uuid(),
  consent: z.boolean(),
}

const deviceSchema = z.object({
  /** "412x915", in CSS pixels. */
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
  /** A page seen. `pv` is the view's own id, so time spent there can be added to it later. */
  z.object({
    ...common,
    t: z.literal("view"),
    pv: z.uuid(),
    path: z.string().min(1).max(600),
    /** document.referrer, sent with the first page after the site is opened. */
    ref: z.string().max(1000).optional(),
    device: deviceSchema.optional(),
  }),
  /** Seconds spent on a page since the last report. */
  z.object({
    ...common,
    t: z.literal("time"),
    pv: z.uuid(),
    s: z.number().int().min(1).max(1800),
  }),
  /** The cart as it now stands, or the basket that reached checkout. */
  z.object({
    ...common,
    t: z.literal("cart"),
    items: z.array(lineSchema).max(20),
    checkout: z.boolean().optional(),
  }),
  /** Details typed at checkout. Kept only for a visitor who accepted cookies. */
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
  /** An order was placed from the basket. */
  z.object({
    ...common,
    t: z.literal("placed"),
    number: z.string().trim().max(40).optional(),
  }),
  /** The visitor chose, or changed their mind. `consent` carries the answer. */
  z.object({
    ...common,
    t: z.literal("consent"),
  }),
])

export type VisitInput = z.infer<typeof visitSchema>
