import { describe, expect, it } from "vitest"

import { renderOrderShipped } from "@/features/orders/emails/order-shipped"

const base = {
  number: "SKM-2026-67V4",
  courier: "Delhivery Surface",
  awb: "19041424751540",
  trackingUrl: "https://shiprocket.co/tracking/19041424751540",
  items: [{ name: "Flame Skull Helmet Mount · Blaze Orange", qty: 1 }],
}

describe("renderOrderShipped", () => {
  it("puts the order number in the subject", () => {
    expect(renderOrderShipped(base).subject).toBe("Order SKM-2026-67V4 has shipped")
  })

  it("carries the courier and the AWB in both parts", () => {
    const m = renderOrderShipped(base)
    for (const body of [m.text, m.html]) {
      expect(body).toContain("Delhivery Surface")
      expect(body).toContain("19041424751540")
    }
  })

  it("links the courier's live tracking when there is one", () => {
    const m = renderOrderShipped(base)
    expect(m.text).toContain("https://shiprocket.co/tracking/19041424751540")
    expect(m.html).toContain('href="https://shiprocket.co/tracking/19041424751540"')
  })

  it("still points at /track for a courier typed in by hand", () => {
    const m = renderOrderShipped({ ...base, trackingUrl: null, awb: null })
    expect(m.text).toContain("/track")
    expect(m.text).not.toContain("AWB")
  })

  it("escapes what it interpolates", () => {
    const m = renderOrderShipped({ ...base, courier: "<script>x</script>" })
    expect(m.html).not.toContain("<script>x</script>")
    expect(m.html).toContain("&lt;script&gt;")
  })
})
