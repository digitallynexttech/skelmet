import { createHmac } from "node:crypto"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { toPaise } from "@/features/checkout/server/payment-gateway"

/**
 * The signature checks are the only thing standing between a POST and a free
 * order, so they get tested for what they REFUSE rather than what they accept.
 *
 * No database here, so the keys come from .env - the fallback every setting
 * has. What Settings adds on top is covered in runtime-settings.test.ts.
 */
const KEY_SECRET = "test-key-secret"
const WEBHOOK_SECRET = "test-webhook-secret"

const original = { ...process.env }

/** A fresh copy, so the env cache is read again after a test changes it. */
async function gateway() {
  vi.resetModules()
  return import("@/features/checkout/server/payment-gateway")
}

beforeEach(() => {
  delete process.env.DATABASE_URL
  process.env.PAYMENT_KEY_ID = "rzp_test_key"
  process.env.PAYMENT_KEY_SECRET = KEY_SECRET
  process.env.PAYMENT_WEBHOOK_SECRET = WEBHOOK_SECRET
})

afterEach(() => {
  process.env = { ...original }
  vi.doUnmock("@/features/settings/server/runtime-settings")
})

describe("toPaise", () => {
  it("converts rupees to integer paise", () => {
    expect(toPaise(3499)).toBe(349_900)
    expect(toPaise("3499")).toBe(349_900)
  })

  it("rounds rather than truncating, so 0.1 + 0.2 cannot lose a paisa", () => {
    expect(toPaise(0.1 + 0.2)).toBe(30)
    expect(toPaise("1234.565")).toBe(123_457)
  })
})

describe("verifyPaymentSignature", () => {
  const sign = (order: string, payment: string, secret = KEY_SECRET) =>
    createHmac("sha256", secret).update(`${order}|${payment}`).digest("hex")

  it("accepts the signature Razorpay would send", async () => {
    const gw = await gateway()
    expect(
      await gw.verifyPaymentSignature(
        {
          gatewayOrderId: "order_A",
          gatewayPaymentId: "pay_B",
          signature: sign("order_A", "pay_B"),
        },
        "test",
      ),
    ).toBe(true)
  })

  it("rejects a signature made with a different secret", async () => {
    const gw = await gateway()
    expect(
      await gw.verifyPaymentSignature(
        {
          gatewayOrderId: "order_A",
          gatewayPaymentId: "pay_B",
          signature: sign("order_A", "pay_B", "not-the-secret"),
        },
        "test",
      ),
    ).toBe(false)
  })

  it("rejects a signature lifted from a different order", async () => {
    // Replaying someone else's valid pair must not authorise this one.
    const gw = await gateway()
    expect(
      await gw.verifyPaymentSignature(
        {
          gatewayOrderId: "order_A",
          gatewayPaymentId: "pay_B",
          signature: sign("order_OTHER", "pay_B"),
        },
        "test",
      ),
    ).toBe(false)
  })

  it("rejects empty and malformed signatures without throwing", async () => {
    // timingSafeEqual throws on a length mismatch, so the length pre-check
    // matters as much as the comparison.
    const gw = await gateway()
    for (const signature of ["", "deadbeef", "z".repeat(64)]) {
      expect(
        await gw.verifyPaymentSignature(
          { gatewayOrderId: "o", gatewayPaymentId: "p", signature },
          "test",
        ),
      ).toBe(false)
    }
  })

  it("checks against the account the payment was opened on, which has no keys here", async () => {
    // .env holds test keys only. A payment recorded as live must not be
    // waved through with the test secret.
    const gw = await gateway()
    expect(
      await gw.verifyPaymentSignature(
        {
          gatewayOrderId: "order_A",
          gatewayPaymentId: "pay_B",
          signature: sign("order_A", "pay_B"),
        },
        "live",
      ),
    ).toBe(false)
  })
})

describe("verifyWebhookSignature", () => {
  const body = JSON.stringify({ event: "payment.captured" })
  const sign = (raw: string, secret = WEBHOOK_SECRET) =>
    createHmac("sha256", secret).update(raw).digest("hex")

  it("accepts a correctly signed raw body", async () => {
    const gw = await gateway()
    expect(await gw.verifyWebhookSignature(body, sign(body))).toBe(true)
  })

  it("rejects when the body has been re-serialised", async () => {
    // The whole reason the route reads text() and never re-stringifies.
    const gw = await gateway()
    const reserialised = JSON.stringify(JSON.parse(body), null, 2)
    expect(await gw.verifyWebhookSignature(reserialised, sign(body))).toBe(false)
  })

  it("rejects a missing signature header", async () => {
    const gw = await gateway()
    expect(await gw.verifyWebhookSignature(body, null)).toBe(false)
  })

  it("FAILS CLOSED when no webhook secret is configured", async () => {
    // Unset, every delivery must be refused - never waved through.
    delete process.env.PAYMENT_WEBHOOK_SECRET
    const gw = await gateway()
    expect(await gw.verifyWebhookSignature(body, sign(body))).toBe(false)
  })

  it("accepts either account's secret, so test payments in flight survive a switch to live", async () => {
    vi.resetModules()
    vi.doMock("@/features/settings/server/runtime-settings", () => ({
      paymentConfig: async () => ({
        mode: "live",
        envMode: "test",
        test: { keyId: "rzp_test_a", keySecret: "s1", webhookSecret: "test-hook" },
        live: { keyId: "rzp_live_b", keySecret: "s2", webhookSecret: "live-hook" },
      }),
    }))
    const gw = await import("@/features/checkout/server/payment-gateway")

    expect(await gw.verifyWebhookSignature(body, sign(body, "test-hook"))).toBe(true)
    expect(await gw.verifyWebhookSignature(body, sign(body, "live-hook"))).toBe(true)
    expect(await gw.verifyWebhookSignature(body, sign(body, "someone-else"))).toBe(false)
  })
})

describe("isGatewayConfigured", () => {
  it("is true with both halves of the key pair", async () => {
    const gw = await gateway()
    expect(await gw.isGatewayConfigured()).toBe(true)
  })

  it("is false with only the key id", async () => {
    delete process.env.PAYMENT_KEY_SECRET
    const gw = await gateway()
    expect(await gw.isGatewayConfigured()).toBe(false)
  })
})

describe("modeOfPayment", () => {
  it("keeps the account a payment recorded", async () => {
    const gw = await gateway()
    expect(gw.modeOfPayment("live", { mode: "test", envMode: "test" })).toBe("live")
    expect(gw.modeOfPayment("test", { mode: "live", envMode: "live" })).toBe("test")
  })

  it("puts a payment from before the switch existed on .env's account, not the one switched on", async () => {
    const gw = await gateway()
    expect(gw.modeOfPayment(null, { mode: "live", envMode: "test" })).toBe("test")
    expect(gw.modeOfPayment(undefined, { mode: "live", envMode: null })).toBe("live")
  })
})
