import { NextResponse, type NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

import { isUnknownPage } from "@/lib/known-pages"

/**
 * Next 16 middleware, renamed to proxy.ts (§2).
 *
 * The auth fence and page RBAC. Hiding a nav item is cosmetic; this file and
 * the service guard are the enforcement (§6).
 *
 * There is exactly one population behind this fence: staff. Customers do not
 * get accounts - they buy as guests, get a confirmation email, and look an
 * order up by number and email at /track, which is public and needs no
 * session. The /account rules that used to sit here fenced routes that were
 * never built and now never will be.
 */

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
 * The console's API authenticates with a cookie, and a cookie rides along on
 * a request another site makes the browser send. So a write to /api/admin or
 * /api/me from another origin is refused here, before anything reads it:
 * when the browser says the request is cross-site (Sec-Fetch-Site), or when
 * its Origin names a different host from the one it was sent to. A request
 * with neither header - curl, a server - is not a browser carrying someone's
 * cookie, and is left to the session check.
 */
export function isCrossSiteWrite(req: NextRequest): boolean {
  const { pathname } = req.nextUrl
  if (!under(pathname, "/api/admin") && !under(pathname, "/api/me")) return false

  const method = req.method.toUpperCase()
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    // Reading an invoice or credit note the first time ISSUES its number, so
    // these GETs are writes in all but name.
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
 * Whether Auth.js set its session cookie with the `__Secure-` prefix, worked
 * out the way Auth.js does: from AUTH_URL when it is set, otherwise from the
 * scheme the request arrived with - which, behind a proxy that ends TLS, is
 * only in X-Forwarded-Proto. Reading the scheme off the URL alone looked for
 * the plain cookie while Auth.js had set the secure one, and every console
 * request bounced to the login page.
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

  if (isCrossSiteWrite(req)) {
    return json(403, "FORBIDDEN", "That request came from another site, so it was refused.")
  }

  const rule = ROUTE_RULES.find((r) => under(pathname, r.prefix))
  if (!rule) return NextResponse.next()

  const isApi = pathname.startsWith("/api/")

  if (!AUTH_READY) {
    // Nothing behind the fence can work without a secret. Answer as if the
    // route does not exist rather than advertising that it is coming.
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

  // Wrong population: 404, never 403, so a customer cannot probe what the
  // staff area contains (§6).
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
  ],
}
