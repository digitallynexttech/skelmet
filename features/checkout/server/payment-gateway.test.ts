import { createHmac } from "node:crypto"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import {
  isGatewayConfigured,
  toPaise,
  verifyPaymentSignature,
  verifyWebhookSignature,
} from "@/features/checkout/server/payment-gateway"

/**
 * The signature checks are the only thing standing between a POST and a free
 * order, so they get tested for what they REFUSE rather than what they accept.
 */
const KEY_SECRET = "test-key-secret"
const WEBHOOK_SECRET = "test-webhook-secret"

const original = { ...process.env }

beforeEach(() => {
  process.env.PAYMENT_KEY_ID = "rzp_test_key"
  process.env.PAYMENT_KEY_SECRET = KEY_SECRET
  process.env.PAYMENT_WEBHOOK_SECRET = WEBHOOK_SECRET
})

afterEach(() => {
  process.env = { ...original }
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

  it("accepts the signature Razorpay would send", () => {
    expect(
      verifyPaymentSignature({
        gatewayOrderId: "order_A",
        gatewayPaymentId: "pay_B",
        signature: sign("order_A", "pay_B"),
      }),
    ).toBe(true)
  })

  it("rejects a signature made with a different secret", () => {
    expect(
      verifyPaymentSignature({
        gatewayOrderId: "order_A",
        gatewayPaymentId: "pay_B",
        signature: sign("order_A", "pay_B", "not-the-secret"),
      }),
    ).toBe(false)
  })

  it("rejects a signature lifted from a different order", () => {
    // Replaying someone else's valid pair must not authorise this one.
    expect(
      verifyPaymentSignature({
        gatewayOrderId: "order_A",
        gatewayPaymentId: "pay_B",
        signature: sign("order_OTHER", "pay_B"),
      }),
    ).toBe(false)
  })

  it("rejects empty and malformed signatures without throwing", () => {
    // timingSafeEqual throws on a length mismatch, so the length pre-check
    // matters as much as the comparison.
    for (const signature of ["", "deadbeef", "z".repeat(64)]) {
      expect(
        verifyPaymentSignature({ gatewayOrderId: "o", gatewayPaymentId: "p", signature }),
      ).toBe(false)
    }
  })
})

describe("verifyWebhookSignature", () => {
  const body = JSON.stringify({ event: "payment.captured" })
  const sign = (raw: string, secret = WEBHOOK_SECRET) =>
    createHmac("sha256", secret).update(raw).digest("hex")

  it("accepts a correctly signed raw body", () => {
    expect(verifyWebhookSignature(body, sign(body))).toBe(true)
  })

  it("rejects when the body has been re-serialised", () => {
    // The whole reason the route reads text() and never re-stringifies.
    const reserialised = JSON.stringify(JSON.parse(body), null, 2)
    expect(verifyWebhookSignature(reserialised, sign(body))).toBe(false)
  })

  it("rejects a missing signature header", () => {
    expect(verifyWebhookSignature(body, null)).toBe(false)
  })

  it("FAILS CLOSED when no webhook secret is configured", () => {
    // Unset, every delivery must be refused - never waved through.
    delete process.env.PAYMENT_WEBHOOK_SECRET
    expect(verifyWebhookSignature(body, sign(body))).toBe(false)
  })
})

describe("isGatewayConfigured", () => {
  it("is false unless both halves of the key pair are present", () => {
    expect(isGatewayConfigured()).toBe(true)
    delete process.env.PAYMENT_KEY_SECRET
    expect(isGatewayConfigured()).toBe(false)
  })
})
