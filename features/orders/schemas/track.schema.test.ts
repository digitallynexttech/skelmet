import { describe, expect, it } from "vitest"

import { trackOrderSchema } from "@/features/orders/schemas/track.schema"

/**
 * A parse test per schema (§6). This one guards the normalisation the lookup
 * depends on: someone reading a number off a phone screen types it however
 * they like, and the service compares it verbatim.
 */
describe("trackOrderSchema", () => {
  const valid = { orderNumber: "SKM-2026-WJMR", email: "rider@example.com" }

  it("accepts a well-formed pair", () => {
    expect(trackOrderSchema.parse(valid)).toEqual(valid)
  })

  it("upper-cases the order number, so a lowercase typing still matches", () => {
    const out = trackOrderSchema.parse({ ...valid, orderNumber: "skm-2026-wjmr" })
    expect(out.orderNumber).toBe("SKM-2026-WJMR")
  })

  it("trims surrounding whitespace from a pasted number", () => {
    const out = trackOrderSchema.parse({ ...valid, orderNumber: "  SKM-2026-WJMR  " })
    expect(out.orderNumber).toBe("SKM-2026-WJMR")
  })

  it("requires both halves — a number alone is not a credential", () => {
    expect(trackOrderSchema.safeParse({ orderNumber: "SKM-2026-WJMR" }).success).toBe(false)
    expect(trackOrderSchema.safeParse({ email: "rider@example.com" }).success).toBe(false)
  })

  it("rejects an empty number and a malformed email", () => {
    expect(trackOrderSchema.safeParse({ ...valid, orderNumber: "   " }).success).toBe(false)
    expect(trackOrderSchema.safeParse({ ...valid, email: "not-an-email" }).success).toBe(false)
  })
})
