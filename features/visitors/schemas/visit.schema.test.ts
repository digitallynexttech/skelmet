import { describe, expect, it } from "vitest"

import { visitSchema } from "@/features/visitors/schemas/visit.schema"

const sid = "4f8b6c1e-2d3a-4b5c-9d7e-1a2b3c4d5e6f"
const pv = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d"

describe("visitSchema", () => {
  it("accepts a page view", () => {
    const parsed = visitSchema.parse({
      t: "view",
      sid,
      consent: false,
      pv,
      path: "/product/flame-skull-mount",
      ref: "https://l.instagram.com/",
      device: { screen: "412x915", lang: "en-IN", tz: "Asia/Kolkata", touch: 5 },
    })
    expect(parsed.t).toBe("view")
  })

  it("refuses time that is not a positive number of seconds under half an hour", () => {
    expect(visitSchema.safeParse({ t: "time", sid, consent: true, pv, s: 0 }).success).toBe(false)
    expect(visitSchema.safeParse({ t: "time", sid, consent: true, pv, s: 1801 }).success).toBe(
      false,
    )
    expect(visitSchema.safeParse({ t: "time", sid, consent: true, pv, s: 12 }).success).toBe(true)
  })

  it("caps a cart at checkout's own limits", () => {
    const line = { sku: "SKM-BLZ", qty: 10 }
    expect(visitSchema.safeParse({ t: "cart", sid, consent: true, items: [line] }).success).toBe(
      false,
    )
  })

  it("only takes contact details in the shape checkout does", () => {
    const base = { t: "contact", sid, consent: true }
    expect(visitSchema.safeParse({ ...base, email: "rider@example.in" }).success).toBe(true)
    expect(visitSchema.safeParse({ ...base, email: "not an email" }).success).toBe(false)
    expect(visitSchema.safeParse({ ...base, phone: "9876543210" }).success).toBe(true)
    expect(visitSchema.safeParse({ ...base, phone: "+919876543210" }).success).toBe(false)
    expect(visitSchema.safeParse({ ...base, pincode: "012345" }).success).toBe(false)
  })

  it("refuses a message that does not name its visit", () => {
    expect(visitSchema.safeParse({ t: "placed", consent: false }).success).toBe(false)
    expect(visitSchema.safeParse({ t: "placed", sid: "tab-1", consent: false }).success).toBe(false)
  })
})
