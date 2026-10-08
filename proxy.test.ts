import { NextRequest } from "next/server"
import { afterEach, describe, expect, it } from "vitest"

import { isCrossSiteWrite, proxy, usesSecureCookie } from "@/proxy"

const req = (url: string, init: { method?: string; headers?: Record<string, string> } = {}) =>
  new NextRequest(url, { method: init.method ?? "GET", headers: init.headers })

const original = { ...process.env }
afterEach(() => {
  process.env = { ...original }
})

describe("isCrossSiteWrite", () => {
  it("lets the console write to its own API", () => {
    expect(
      isCrossSiteWrite(
        req("https://skelmet.in/api/admin/orders/x/pack", {
          method: "POST",
          headers: {
            origin: "https://skelmet.in",
            host: "skelmet.in",
            "sec-fetch-site": "same-origin",
          },
        }),
      ),
    ).toBe(false)
  })

  it("refuses a write the browser marks cross-site", () => {
    expect(
      isCrossSiteWrite(
        req("https://skelmet.in/api/me/password", {
          method: "POST",
          headers: { host: "skelmet.in", "sec-fetch-site": "cross-site" },
        }),
      ),
    ).toBe(true)
  })

  it("refuses a write whose Origin is another host, or null", () => {
    for (const origin of ["https://evil.example", "https://skelmet.in.evil.example", "null"]) {
      expect(
        isCrossSiteWrite(
          req("https://skelmet.in/api/admin/staff", {
            method: "DELETE",
            headers: { origin, host: "skelmet.in" },
          }),
        ),
        origin,
      ).toBe(true)
    }
  })

  it("compares with the forwarded host when a proxy sets one", () => {
    const write = (host: string) =>
      req("http://127.0.0.1:3000/api/admin/coupons", {
        method: "POST",
        headers: { origin: "https://skelmet.in", host: "127.0.0.1:3000", "x-forwarded-host": host },
      })
    expect(isCrossSiteWrite(write("skelmet.in"))).toBe(false)
    expect(isCrossSiteWrite(write("other.example"))).toBe(true)
  })

  it("leaves reads alone, except those that issue an invoice or credit note number", () => {
    const get = (path: string) =>
      req(`https://skelmet.in${path}`, { headers: { "sec-fetch-site": "cross-site" } })
    expect(isCrossSiteWrite(get("/api/admin/orders"))).toBe(false)
    expect(isCrossSiteWrite(get("/api/admin/orders/abc/invoice"))).toBe(true)
    expect(isCrossSiteWrite(get("/api/admin/orders/abc/credit-note"))).toBe(true)
    expect(
      isCrossSiteWrite(
        req("https://skelmet.in/api/admin/orders/abc/invoice", {
          headers: { "sec-fetch-site": "same-origin" },
        }),
      ),
    ).toBe(false)
  })

  it("never touches Auth.js's own routes or the public API", () => {
    for (const path of [
      "/api/auth/callback/credentials",
      "/api/checkout/session",
      "/api/public/track",
    ]) {
      expect(
        isCrossSiteWrite(
          req(`https://skelmet.in${path}`, {
            method: "POST",
            headers: { origin: "https://evil.example", "sec-fetch-site": "cross-site" },
          }),
        ),
      ).toBe(false)
    }
  })
})

describe("proxy", () => {
  it("answers a cross-site write with the 403 envelope", async () => {
    const res = await proxy(
      req("https://skelmet.in/api/admin/orders/x/refund", {
        method: "POST",
        headers: { origin: "https://evil.example", host: "skelmet.in" },
      }),
    )
    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ success: false, error: { code: "FORBIDDEN" } })
  })
})

describe("usesSecureCookie", () => {
  it("follows AUTH_URL when it is set, as Auth.js does", () => {
    process.env.AUTH_URL = "https://skelmet.in"
    expect(usesSecureCookie(req("http://127.0.0.1:3000/admin"))).toBe(true)
    process.env.AUTH_URL = "http://localhost:3000"
    expect(usesSecureCookie(req("https://skelmet.in/admin"))).toBe(false)
  })

  it("otherwise reads the scheme the proxy forwarded", () => {
    delete process.env.AUTH_URL
    delete process.env.NEXTAUTH_URL
    expect(
      usesSecureCookie(
        req("http://127.0.0.1:3000/admin", { headers: { "x-forwarded-proto": "https" } }),
      ),
    ).toBe(true)
    expect(usesSecureCookie(req("http://127.0.0.1:3000/admin"))).toBe(false)
  })
})
