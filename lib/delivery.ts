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
 * The upper bound of the published promise, not the middle: quoting the
 * optimistic end of "3–6 working days" turns a normal delivery into a late
 * one.
 */
const DELIVERY_DAYS = 6

/**
 * Date.UTC rather than `new Date(y, m, d)`. The server runs UTC, and local
 * midnight would shift the date by a day for anyone east or west of it (§6).
 */
export function deliveryEta(placedIso: string): Date {
  const placed = new Date(placedIso)
  return new Date(
    Date.UTC(placed.getUTCFullYear(), placed.getUTCMonth(), placed.getUTCDate() + DELIVERY_DAYS),
  )
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
