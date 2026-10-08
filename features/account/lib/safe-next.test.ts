import { describe, expect, it } from "vitest"

import { DEFAULT_NEXT, safeNextPath } from "@/features/account/lib/safe-next"

// Every off-site form below passes a naive "starts with / and not //" check.
describe("safeNextPath", () => {
  it("keeps console pages, with their query", () => {
    expect(safeNextPath("/admin")).toBe("/admin")
    expect(safeNextPath("/admin/orders?status=PAID")).toBe("/admin/orders?status=PAID")
    expect(safeNextPath("/change-password")).toBe("/change-password")
    expect(safeNextPath("/change-password?next=/admin/settings")).toBe(
      "/change-password?next=/admin/settings",
    )
  })

  it("refuses everything that leaves the site", () => {
    for (const next of [
      "/\\evil.example",
      "/\t/evil.example",
      "/\n/evil.example",
      "//evil.example",
      "///evil.example",
      "\\\\evil.example",
      "https://evil.example",
      "javascript:alert(1)",
      "/admin\\@evil.example",
      "/%09/evil.example",
    ]) {
      expect(safeNextPath(next), JSON.stringify(next)).toBe(DEFAULT_NEXT)
    }
  })

  it("refuses pages outside the console", () => {
    expect(safeNextPath("/")).toBe(DEFAULT_NEXT)
    expect(safeNextPath("/product/flame-skull-mount")).toBe(DEFAULT_NEXT)
    expect(safeNextPath("/administrator")).toBe(DEFAULT_NEXT)
    expect(safeNextPath("/admin/../checkout")).toBe(DEFAULT_NEXT)
  })

  it("falls back when there is nothing to go to", () => {
    expect(safeNextPath(undefined)).toBe(DEFAULT_NEXT)
    expect(safeNextPath(null)).toBe(DEFAULT_NEXT)
    expect(safeNextPath("")).toBe(DEFAULT_NEXT)
  })
})
