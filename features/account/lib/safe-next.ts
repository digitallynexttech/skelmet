/**
 * Where to send someone after they sign in or change their password: the
 * `?next=` they arrived with, if it is a page of the console, and /admin
 * otherwise.
 *
 * "Starts with / and not //" was the whole check, and browsers read more
 * into a path than that: `/\evil.example` and `/<TAB>/evil.example` both
 * passed it and both take the browser off-site, because a backslash is a
 * slash to the URL parser and tabs and newlines are dropped from URLs before
 * they are read. So the value is parsed the way a browser would parse it,
 * against a placeholder origin, and has to stay on that origin - and inside
 * the console, since nothing else here is worth bouncing a login to.
 *
 * Client-safe: the login form runs it again before it navigates.
 */
export const DEFAULT_NEXT = "/admin"

const PLACEHOLDER = "https://x.invalid"

export function safeNextPath(next: string | null | undefined): string {
  if (typeof next !== "string" || next.length === 0 || next.length > 2_000) return DEFAULT_NEXT
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return DEFAULT_NEXT
  if (next.includes("\\")) return DEFAULT_NEXT
  // Tabs and newlines are dropped by the URL parser, so they are refused here.
  if (/[\u0000-\u001f\u007f]/.test(next)) return DEFAULT_NEXT

  let url: URL
  try {
    url = new URL(next, PLACEHOLDER)
  } catch {
    return DEFAULT_NEXT
  }
  if (url.origin !== PLACEHOLDER) return DEFAULT_NEXT

  const path = url.pathname
  const inside =
    path === "/admin" ||
    path.startsWith("/admin/") ||
    path === "/change-password" ||
    path.startsWith("/change-password/")
  return inside ? `${path}${url.search}${url.hash}` : DEFAULT_NEXT
}
