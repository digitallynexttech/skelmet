import { siteConfig } from "@/lib/config/site"

// The promise: dispatch within 48 hours (2 working days), then delivery within
// 7 working days. Quoted at its upper bound, in working days from the IST date.
// Shared so the confirmation page and /track show the same date.
const DISPATCH_WORKING_DAYS = Math.ceil(siteConfig.promise.dispatchHours / 24)
const DELIVERY_WORKING_DAYS = 7

const IST_OFFSET_MS = 5.5 * 60 * 60_000

// `day` is a UTC-midnight date standing for a calendar day.
const isWorkingDay = (day: Date) => day.getUTCDay() !== 0 && day.getUTCDay() !== 6

/** A UTC-midnight Date standing for a calendar day: format it in UTC. */
export function deliveryEta(placedIso: string): Date {
  const placed = new Date(placedIso)
  const inIndia = new Date(placed.getTime() + IST_OFFSET_MS)
  const day = new Date(
    Date.UTC(inIndia.getUTCFullYear(), inIndia.getUTCMonth(), inIndia.getUTCDate()),
  )
  let left = DISPATCH_WORKING_DAYS + DELIVERY_WORKING_DAYS
  while (left > 0) {
    day.setUTCDate(day.getUTCDate() + 1)
    if (isWorkingDay(day)) left -= 1
  }
  return day
}

/** `TUE, 30 SEP` */
export function formatEta(placedIso: string): string {
  return deliveryEta(placedIso)
    .toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    })
    .toUpperCase()
}

/** `24 Sept 2026` */
export function formatDay(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
}

export const deliveryWindow = siteConfig.promise.deliveryDays
