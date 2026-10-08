import { NextResponse, type NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

import { isUnknownPost } from "@/features/blog/server/known-posts"
import { isUnknownPage } from "@/lib/known-pages"

// The auth fence (Next 16's middleware). With the service guards, this is the
// enforcement; hiding a nav item is cosmetic. Only staff sign in.

type RouteRule = {
  prefix: string
  kind: "STAFF"
}

export const ROUTE_RULES: RouteRule[] = [
  { prefix: "/admin", kind: "STAFF" },
  { prefix: "/api/admin", kind: "STAFF" },
]

const AUTH_READY = Boolean(process.env.AUTH_SECRET)

const under = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`)

/**
 * CSRF: cookie-authenticated writes from another origin (Sec-Fetch-Site or a
 * mismatched Origin) are refused. No header at all is not a browser; the
 * session check handles it.
 */
export function isCrossSiteWrite(req: NextRequest): boolean {
  const { pathname } = req.nextUrl
  if (!under(pathname, "/api/admin") && !under(pathname, "/api/me")) return false

  const method = req.method.toUpperCase()
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    // The first read of an invoice or credit note issues its number: a write.
    return issuesADocument(pathname) && req.headers.get("sec-fetch-site") === "cross-site"
  }

  if (req.headers.get("sec-fetch-site") === "cross-site") return true

  const origin = req.headers.get("origin")
  if (!origin) return false
  let originHost: string
  try {
    originHost = new URL(origin).host.toLowerCase()
  } catch {
    // "null" - a sandboxed frame or a cross-site redirect.
    return true
  }
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "")
    .split(",")[0]!
    .trim()
    .toLowerCase()
  return !host || originHost !== host
}

function issuesADocument(pathname: string): boolean {
  return /^\/api\/admin\/orders\/[^/]+\/(invoice|credit-note)$/.test(pathname)
}

/**
 * Must match Auth.js's choice of the `__Secure-` cookie: AUTH_URL, else
 * X-Forwarded-Proto (TLS ends at the proxy), or every request bounces to login.
 */
export function usesSecureCookie(req: NextRequest): boolean {
  const envUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL
  if (envUrl) {
    try {
      return new URL(envUrl).protocol === "https:"
    } catch {
      // Fall through to the request's own scheme.
    }
  }
  const forwarded = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim()
  if (forwarded) return forwarded === "https" || forwarded === "https:"
  return req.nextUrl.protocol === "https:"
}

const json = (status: number, code: string, message: string) =>
  NextResponse.json({ success: false, error: { code, message } }, { status })

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (isUnknownPage(pathname)) return NextResponse.rewrite(new URL("/not-found", req.url))
  // Posts come from Sanity, so which ones exist is asked there (and kept for a minute).
  if (await isUnknownPost(pathname)) return NextResponse.rewrite(new URL("/not-found", req.url))

  if (isCrossSiteWrite(req)) {
    return json(403, "FORBIDDEN", "That request came from another site, so it was refused.")
  }

  const rule = ROUTE_RULES.find((r) => under(pathname, r.prefix))
  if (!rule) return NextResponse.next()

  const isApi = pathname.startsWith("/api/")

  if (!AUTH_READY) {
    // Nothing here works without a secret: answer as if the route did not exist.
    return isApi
      ? json(404, "NOT_FOUND", "Not found.")
      : NextResponse.rewrite(new URL("/not-found", req.url))
  }

  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET,
    secureCookie: usesSecureCookie(req),
  })

  if (!token) {
    if (isApi) return json(401, "UNAUTHORIZED", "Sign in to continue.")
    const login = new URL("/login", req.url)
    login.searchParams.set("next", pathname)
    return NextResponse.redirect(login)
  }

  // 404, never 403, so a non-staff user cannot probe the staff area.
  if (token.kind !== rule.kind) {
    return isApi
      ? json(404, "NOT_FOUND", "Not found.")
      : NextResponse.rewrite(new URL("/not-found", req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/admin/:path*",
    "/api/me/:path*",
    "/product/:path*",
    "/policies/:path*",
    "/blog/:path+",
  ],
}
