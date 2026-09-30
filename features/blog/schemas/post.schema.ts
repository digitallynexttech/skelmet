import { z } from "zod"

/**
 * A post's id in Sanity: the published document's, never a draft's. What the
 * Studio makes is a UUID, and nothing with a dot in it - a dot marks a draft
 * or a version, and naming one here would let a request publish the wrong
 * document.
 */
export const postIdSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/, "That is not a post")

/** How far ahead a post may be scheduled. Further is a slip of the date picker. */
export const SCHEDULE_AHEAD_DAYS = 365

/**
 * When a scheduled post goes live: a moment still to come, and within a year.
 * Client-safe, so the console checks the date picker with the rule the
 * server applies.
 */
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
