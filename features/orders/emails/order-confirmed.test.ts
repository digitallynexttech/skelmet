import { describe, expect, it } from "vitest"

import { renderOrderConfirmed } from "@/features/orders/emails/order-confirmed"

/**
 * With no customer accounts, this email is the only record a buyer keeps of
 * their order number — and that number plus their email is the whole
 * credential for /track. So these tests are mostly about the number being
 * impossible to miss.
 */
const base = {
  number: "SKM-2026-67V4",
  email: "rider@example.com",
  total: "3548",
  items: [{ name: "Flame Skull Helmet Mount · Blaze Orange", qty: 1 }],
}

describe("renderOrderConfirmed", () => {
  it("puts the order number in the subject, where inbox search will find it", () => {
    const m = renderOrderConfirmed({ ...base, paymentMethod: "COD" })
    expect(m.subject).toContain("SKM-2026-67V4")
  })

  it("carries the number and the items in both parts", () => {
    const m = renderOrderConfirmed({ ...base, paymentMethod: "COD" })
    for (const body of [m.text, m.html]) {
      expect(body).toContain("SKM-2026-67V4")
      expect(body).toContain("Flame Skull Helmet Mount")
    }
  })

  it("says due on delivery for COD, not paid", () => {
    const m = renderOrderConfirmed({ ...base, paymentMethod: "COD" })
    expect(m.text).toMatch(/Due on delivery/i)
    expect(m.text).not.toMatch(/^Paid:/m)
  })

  it("says paid for an online order", () => {
    const m = renderOrderConfirmed({ ...base, paymentMethod: "ONLINE" })
    expect(m.text).toMatch(/Paid:/)
    expect(m.text).not.toMatch(/cash on delivery/i)
  })

  it("tells them there is no account, because there is not one", () => {
    const m = renderOrderConfirmed({ ...base, paymentMethod: "COD" })
    expect(m.text).toMatch(/no account/i)
    expect(m.text).toContain("/track")
  })

  it("escapes HTML in a product name rather than injecting it", () => {
    const m = renderOrderConfirmed({
      ...base,
      paymentMethod: "COD",
      items: [{ name: '<script>alert("x")</script>', qty: 1 }],
    })
    expect(m.html).not.toContain("<script>")
    expect(m.html).toContain("&lt;script&gt;")
  })
})
