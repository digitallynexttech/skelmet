import { z } from "zod"

/** Booking a courier. No id means Shiprocket's own pick for the account. */
export const bookShipmentSchema = z.object({
  courierId: z.number().int().positive().optional(),
})

/** Typing the courier and AWB in by hand, for anything not booked through Shiprocket. */
export const manualShipmentSchema = z.object({
  courier: z.string().trim().min(1, "Enter the courier").max(60),
  awb: z.string().trim().min(1, "Enter the AWB").max(40),
})

export const pincodeSchema = z.object({
  pincode: z
    .string()
    .trim()
    .regex(/^[1-9][0-9]{5}$/, "Enter a valid 6-digit pincode"),
  /**
   * How many mounts the parcel holds, which sets its size and so its price.
   * One on the product page; the cart's count at checkout. The ceiling is
   * the largest order checkout accepts: 20 lines of 9.
   */
  units: z.coerce.number().int().min(1).max(180).default(1),
})

export type BookShipmentInput = z.infer<typeof bookShipmentSchema>
export type ManualShipmentInput = z.infer<typeof manualShipmentSchema>
