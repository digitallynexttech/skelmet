import { describe, expect, it } from "vitest"

import { renderOrderConfirmed } from "@/features/orders/emails/order-confirmed"

/**
 * With no customer accounts, this email is the only record a buyer keeps of
 * their order number - and that number plus their email is the whole
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

  it("states both halves of an order with an advance, and never calls all of it paid", () => {
    const m = renderOrderConfirmed({ ...base, paymentMethod: "PARTIAL", dueOnDelivery: "2838" })
    for (const body of [m.text, m.html]) {
      expect(body).toMatch(/Paid now/)
      expect(body).toContain("₹710")
      expect(body).toMatch(/Due on delivery/)
      expect(body).toContain("₹2,838")
    }
    expect(m.text).not.toMatch(/^Paid:/m)
    expect(m.text).not.toMatch(/cash on delivery/i)
  })

  it("says paid for an online order", () => {
    const m = renderOrderConfirmed({ ...base, paymentMethod: "ONLINE" })
    expect(m.text).toMatch(/Paid:/)
    expect(m.text).not.toMatch(/cash on delivery/i)
  })

  it("never reads as pay-on-delivery for an online order, in either part", () => {
    const m = renderOrderConfirmed({ ...base, paymentMethod: "ONLINE" })
    for (const body of [m.text, m.html]) {
      expect(body).not.toMatch(/on delivery/i)
      expect(body).not.toMatch(/pay the courier/i)
    }
  })

  it("counts dispatch from payment and delivery from dispatch", () => {
    const m = renderOrderConfirmed({ ...base, paymentMethod: "ONLINE" })
    expect(m.text.replace(/\s+/g, " ")).toContain(
      "We dispatch within 48 hours of payment, and delivery takes up to 7 working days from dispatch.",
    )
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
