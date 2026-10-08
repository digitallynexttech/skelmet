import { readdirSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

import { isUnknownPage } from "@/lib/known-pages"

// Too loose and fake URLs are soft 404s; too strict and real files 404.
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

  it("stops made-up names with a dot that is not a file's extension", () => {
    for (const pathname of [
      "/product/x.y",
      "/product/flame-skull-mount.backup",
      "/product/nope.php",
      "/product/a.b.c",
      "/policies/returns.old",
      "/product/.png",
    ]) {
      expect(isUnknownPage(pathname), pathname).toBe(true)
    }
  })

  it("lets any static file extension through, whatever the case", () => {
    for (const pathname of [
      "/product/new-photo.JPG",
      "/product/model.gltf",
      "/product/clip.webm",
      "/product/sitemap.xml",
      "/policies/terms.pdf",
    ]) {
      expect(isUnknownPage(pathname), pathname).toBe(false)
    }
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
