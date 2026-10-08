import { z } from "zod"

/** A published post's Sanity id. No dots: a dot marks a draft or version, the wrong document. */
export const postIdSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/, "That is not a post")

/** Further ahead is a slip of the date picker. */
export const SCHEDULE_AHEAD_DAYS = 365

/** A future time within a year. Client-safe: the console checks the picker with the same rule. */
export const schedulePostSchema = z.strictObject({
  at: z.iso
    .datetime({ offset: true, error: "Choose a date and time" })
    .refine((at) => Date.parse(at) > Date.now(), "Choose a time that has not passed yet")
    .refine(
      (at) => Date.parse(at) <= Date.now() + SCHEDULE_AHEAD_DAYS * 86_400_000,
      "Choose a date within a year from now",
    ),
})
export type SchedulePostInput = z.infer<typeof schedulePostSchema>
