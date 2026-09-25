import { NextResponse, type NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

import { PRODUCTS } from "@/features/catalog/catalog"

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

const PRODUCT_SLUGS = new Set(PRODUCTS.map((p) => p.slug))

/**
 * A product URL the catalogue does not have, answered 404 before it renders.
 *
 * The product page cannot do this itself. notFound() there answers HTTP 200,
 * because the marketing loading boundary has already sent the shell, and the
 * page keeps unknown slugs open (see its `revalidate`) so an admin edit can
 * rebuild it. Every such render would also be kept in the page cache, so
 * random slugs could fill the disk.
 */
function isUnknownProduct(pathname: string): boolean {
  const [, section, slug] = pathname.split("/")
  if (section !== "product" || !slug) return false
  let decoded = slug
  try {
    decoded = decodeURIComponent(slug)
  } catch {
    // A malformed escape is no product either.
  }
  return !PRODUCT_SLUGS.has(decoded)
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (isUnknownProduct(pathname)) return NextResponse.rewrite(new URL("/not-found", req.url))

  const rule = ROUTE_RULES.find((r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`))
  if (!rule) return NextResponse.next()

  const isApi = pathname.startsWith("/api/")

  if (!AUTH_READY) {
    // Nothing behind the fence can work without a secret. Answer as if the
    // route does not exist rather than advertising that it is coming.
    return isApi
      ? NextResponse.json(
          { success: false, error: { code: "NOT_FOUND", message: "Not found." } },
          { status: 404 },
        )
      : NextResponse.rewrite(new URL("/not-found", req.url))
  }

  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET,
    secureCookie: req.nextUrl.protocol === "https:",
  })

  if (!token) {
    if (isApi) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Sign in to continue." } },
        { status: 401 },
      )
    }
    const login = new URL("/login", req.url)
    login.searchParams.set("next", pathname)
    return NextResponse.redirect(login)
  }

  // Wrong population: 404, never 403, so a customer cannot probe what the
  // staff area contains (§6).
  if (token.kind !== rule.kind) {
    return isApi
      ? NextResponse.json(
          { success: false, error: { code: "NOT_FOUND", message: "Not found." } },
          { status: 404 },
        )
      : NextResponse.rewrite(new URL("/not-found", req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/product/:path*"],
}
