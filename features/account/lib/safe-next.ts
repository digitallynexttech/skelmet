export const DEFAULT_NEXT = "/admin"

const PLACEHOLDER = "https://x.invalid"

/**
 * The `?next=` to go to after sign-in, if it is a console page, else /admin. Parsed like a
 * browser would (`/\evil` and `/<TAB>/evil` leave the site) and must stay on the placeholder
 * origin. Client-safe: the login form runs it too.
 */
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
