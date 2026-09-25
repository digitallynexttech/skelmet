import { readdirSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

import { isUnknownPage } from "@/lib/known-pages"

/**
 * proxy.ts answers 404 for what this calls unknown, before anything renders.
 * Too little and fake product URLs are soft 404s; too much and real files go
 * missing - which is how every product photo on the site once disappeared.
 */
describe("isUnknownPage", () => {
  it("lets the real product and policy pages through", () => {
    expect(isUnknownPage("/product/flame-skull-mount")).toBe(false)
    expect(isUnknownPage("/policies/shipping")).toBe(false)
    expect(isUnknownPage("/policies/returns")).toBe(false)
  })

  it("stops product and policy URLs that do not exist", () => {
    expect(isUnknownPage("/product/nope-not-real")).toBe(true)
    expect(isUnknownPage("/product/FLAME-SKULL-MOUNT")).toBe(true)
    expect(isUnknownPage("/policies/referral")).toBe(true)
    expect(isUnknownPage("/product/%E0%A4")).toBe(true)
  })

  it("never stops a file served from public/product", () => {
    const files = readdirSync(path.resolve(import.meta.dirname, "../public/product"))
    expect(files.length).toBeGreaterThan(0)
    for (const file of files) expect(isUnknownPage(`/product/${file}`)).toBe(false)
  })

  it("leaves everything else alone", () => {
    for (const pathname of [
      "/",
      "/product",
      "/product/",
      "/product/flame-skull-mount/extra",
      "/policies/",
      "/admin/settings",
      "/brand/skelmet-mark.png",
    ]) {
      expect(isUnknownPage(pathname)).toBe(false)
    }
  })
})
