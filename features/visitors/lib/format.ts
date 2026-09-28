/**
 * How the console writes visitor facts. Client-safe, shared by the Visitors
 * screens and the abandoned checkouts screen.
 */

/** "42s", "4m 12s", "1h 03m". */
export function duration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, "0")}s`
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`
}

/** "12 Sept, 04:31 pm". */
export function when(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/** "just now", "5 min ago", "3 h ago", "2 days ago", then the date. */
export function ago(iso: string, now = Date.now()): string {
  const s = Math.max(0, (now - new Date(iso).getTime()) / 1000)
  if (s < 90) return "just now"
  if (s < 3600) return `${Math.round(s / 60)} min ago`
  if (s < 86_400) return `${Math.round(s / 3600)} h ago`
  if (s < 7 * 86_400) return `${Math.round(s / 86_400)} days ago`
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
}

/** "Samsung SM-S911B · Android 14 · Chrome 128", from whatever is known. */
export function deviceLine(v: {
  deviceModel?: string | null
  os?: string | null
  browser?: string | null
}): string {
  return [v.deviceModel, v.os, v.browser].filter(Boolean).join(" · ") || "-"
}

/**
 * "Noida, Gautam Buddha Nagar, Uttar Pradesh" - city, district, state - or the
 * country code alone when that is all there is. A district named like its
 * city ("Jaipur, Jaipur") is said once.
 */
export function placeLine(v: {
  city?: string | null
  district?: string | null
  region?: string | null
  country?: string | null
}): string {
  const district =
    v.district && v.district.toLowerCase() !== v.city?.toLowerCase() ? v.district : null
  return [v.city, district, v.region].filter(Boolean).join(", ") || v.country || "-"
}

/** "instagram / social", "direct". */
export function sourceLine(v: { source?: string | null; medium?: string | null }): string {
  if (!v.source) return "-"
  return v.medium ? `${v.source} / ${v.medium}` : v.source
}

/**
 * A WhatsApp chat with the number, the message typed in and left for staff
 * to read over and send. Indian mobiles only, which is all checkout accepts.
 */
export function whatsappLink(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, "").slice(-10)
  return `https://wa.me/91${digits}?text=${encodeURIComponent(message)}`
}

/** The name a visitor goes by in the console. */
export function visitorName(v: {
  id: string
  name: string | null
  email: string | null
  anonymous: boolean
}): string {
  if (v.name) return v.name
  if (v.email) return v.email
  // The id's first characters, so two unnamed visitors can be told apart.
  return `${v.anonymous ? "Anonymous" : "Visitor"} #${v.id.slice(0, 6)}`
}
