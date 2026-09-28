import { siteConfig } from "@/config/site"

/**
 * When a parcel should land.
 *
 * Shared because two screens quote it - the confirmation page and the order
 * tracker - and a customer who sees one date on the receipt and a different
 * one on /track has been told the shop does not know. It lived only on the
 * confirmation page; the tracker, which is the page people open *to find out
 * when it arrives*, did not show a date at all.
 *
 * The published promise is two parts: dispatched within 48 hours - two
 * working days - and then delivered within 7 working days. Kept to its upper
 * bound: quoting the optimistic end turns a normal delivery into a late one.
 *
 * It used to add 7 calendar days to the UTC date, which forgot the dispatch
 * time, counted weekends as working days, and put an order placed after
 * midnight in India on the day before. So an order placed on a Friday was
 * promised for the next Friday when the honest answer is the Thursday after.
 */
const DISPATCH_WORKING_DAYS = Math.ceil(siteConfig.promise.dispatchHours / 24)
const DELIVERY_WORKING_DAYS = 7

const IST_OFFSET_MS = 5.5 * 60 * 60_000

/** Monday to Friday. The day is a UTC-midnight date standing for a calendar day. */
const isWorkingDay = (day: Date) => day.getUTCDay() !== 0 && day.getUTCDay() !== 6

/**
 * The calendar day it should arrive by, as a UTC-midnight Date - a date, not
 * an instant - so formatting it in UTC prints that day. Counted from the day
 * it was placed on in India.
 */
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

/** `TUE, 30 SEP` - short enough to sit beside a label without wrapping. */
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

/** `24 Sept 2026`, for a date that already happened. */
export function formatDay(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
}

export const deliveryWindow = siteConfig.promise.deliveryDays
