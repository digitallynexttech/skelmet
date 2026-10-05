import { describe, expect, it } from "vitest"

import { DASHBOARD_HREF, firstSectionFor } from "@/components/layout/admin-nav"
import { PERMISSIONS } from "@/lib/constants"

describe("firstSectionFor", () => {
  it("sends anyone who may read the dashboard there", () => {
    expect(firstSectionFor([PERMISSIONS.ORDER_READ, PERMISSIONS.DASHBOARD_READ])).toBe(
      "/admin/dashboard",
    )
    expect(DASHBOARD_HREF).toBe("/admin/dashboard")
  })

  it("sends everyone else to the first section they may open, in sidebar order", () => {
    expect(firstSectionFor([PERMISSIONS.INQUIRY_READ, PERMISSIONS.ORDER_READ])).toBe(
      "/admin/orders",
    )
    expect(firstSectionFor([PERMISSIONS.POST_READ])).toBe("/admin/blog")
  })

  it("falls back to the dashboard for no permissions at all", () => {
    expect(firstSectionFor([])).toBe("/admin/dashboard")
  })
})
