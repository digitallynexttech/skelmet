import type { ZodError } from "zod"

/** E.g. "Code: letters, numbers and dashes only." One message per field; past three, counted. */
export function validationMessage(err: ZodError): string {
  const seen = new Set<string>()
  const parts: string[] = []
  for (const issue of err.issues) {
    const key = issue.path.map(String).join(".")
    if (seen.has(key)) continue
    seen.add(key)
    const field = fieldLabel(issue.path)
    const message = issue.message.replace(/\.$/, "")
    parts.push(field ? `${field}: ${lowerFirst(message)}` : message)
  }
  if (parts.length === 0) return "Some of those details are not right."
  const shown = parts.slice(0, 3).map((p) => `${p}.`)
  const more = parts.length - shown.length
  return more > 0 ? `${shown.join(" ")} And ${more} more.` : shown.join(" ")
}

/** `{ field: firstMessage }` by top-level field, for messages under inputs. */
export function fieldErrorsOf(details: unknown): Record<string, string> {
  const fields = (details as { fieldErrors?: Record<string, string[] | undefined> } | null)
    ?.fieldErrors
  if (!fields || typeof fields !== "object") return {}
  const out: Record<string, string> = {}
  for (const [key, messages] of Object.entries(fields)) {
    const first = messages?.[0]
    if (first) out[key] = first
  }
  return out
}

/** `minSubtotal` → "Min subtotal", `address.pincode` → "Pincode", `items.0.qty` → "Qty". */
function fieldLabel(path: PropertyKey[]): string {
  const last = [...path].reverse().find((p) => typeof p === "string")
  if (typeof last !== "string" || last === "") return ""
  const words = last
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

// Leaves acronyms alone.
function lowerFirst(s: string): string {
  if (/^[A-Z]{2,}/.test(s)) return s
  return s.charAt(0).toLowerCase() + s.slice(1)
}
