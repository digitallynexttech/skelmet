import "server-only"

import { createHmac, timingSafeEqual } from "node:crypto"

import { AppError } from "@/lib/errors"

/**
 * Razorpay, over their REST API directly — the SDK is a thin wrapper over these
 * three calls and adds a dependency we do not need.
 *
 * Money crosses this boundary in PAISE (integer). Everywhere else in the app it
 * is rupees as a Decimal/string, so convert at exactly this edge and nowhere
 * else.
 */

const API = "https://api.razorpay.com/v1"

type RazorpayOrder = {
  id: string
  amount: number
  currency: string
  receipt: string
  status: string
}

function credentials(): { keyId: string; keySecret: string } {
  const keyId = process.env.PAYMENT_KEY_ID
  const keySecret = process.env.PAYMENT_KEY_SECRET
  if (!keyId || !keySecret) {
    throw new AppError(
      "Payments are not configured yet.",
      503,
      "GATEWAY_UNCONFIGURED",
    )
  }
  return { keyId, keySecret }
}

export function isGatewayConfigured(): boolean {
  return Boolean(process.env.PAYMENT_KEY_ID && process.env.PAYMENT_KEY_SECRET)
}

/** The publishable key id, safe to hand the browser. */
export function publicKeyId(): string {
  return credentials().keyId
}

export function toPaise(rupees: number | string): number {
  return Math.round(Number(rupees) * 100)
}

export async function createGatewayOrder(input: {
  amountRupees: number | string
  receipt: string
  notes?: Record<string, string>
}): Promise<RazorpayOrder> {
  const { keyId, keySecret } = credentials()
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64")

  const res = await fetch(`${API}/orders`, {
    method: "POST",
    headers: {
      authorization: `Basic ${auth}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      amount: toPaise(input.amountRupees),
      currency: "INR",
      receipt: input.receipt,
      notes: input.notes ?? {},
    }),
    cache: "no-store",
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => "")
    console.error("[RAZORPAY] order create failed", res.status, detail)
    throw new AppError("Could not start the payment. Try again.", 502, "GATEWAY_ERROR")
  }

  return (await res.json()) as RazorpayOrder
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8")
  const bufB = Buffer.from(b, "utf8")
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB)
}

/**
 * Verifies the handler payload the browser returns after a successful payment.
 * Signature = HMAC_SHA256(`${orderId}|${paymentId}`, keySecret).
 */
export function verifyPaymentSignature(input: {
  gatewayOrderId: string
  gatewayPaymentId: string
  signature: string
}): boolean {
  const { keySecret } = credentials()
  const expected = createHmac("sha256", keySecret)
    .update(`${input.gatewayOrderId}|${input.gatewayPaymentId}`)
    .digest("hex")
  return safeEqual(expected, input.signature)
}

/**
 * Verifies a webhook. Signature = HMAC_SHA256(rawBody, webhookSecret), so the
 * route must hand us the raw text, never a re-serialised object.
 *
 * Fails closed when the secret is unset (§6).
 */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET
  if (!secret || !signature) return false
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex")
  return safeEqual(expected, signature)
}

export async function fetchPayment(paymentId: string): Promise<{
  id: string
  status: string
  amount: number
  method?: string
}> {
  const { keyId, keySecret } = credentials()
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64")

  const res = await fetch(`${API}/payments/${paymentId}`, {
    headers: { authorization: `Basic ${auth}` },
    cache: "no-store",
  })
  if (!res.ok) throw new AppError("Could not read the payment.", 502, "GATEWAY_ERROR")
  return (await res.json()) as { id: string; status: string; amount: number; method?: string }
}

export async function refundPayment(input: {
  gatewayPaymentId: string
  amountRupees: number | string
  notes?: Record<string, string>
}): Promise<{ id: string; status: string }> {
  const { keyId, keySecret } = credentials()
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64")

  const res = await fetch(`${API}/payments/${input.gatewayPaymentId}/refund`, {
    method: "POST",
    headers: { authorization: `Basic ${auth}`, "content-type": "application/json" },
    body: JSON.stringify({ amount: toPaise(input.amountRupees), notes: input.notes ?? {} }),
    cache: "no-store",
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => "")
    console.error("[RAZORPAY] refund failed", res.status, detail)
    throw new AppError("Refund could not be issued.", 502, "GATEWAY_ERROR")
  }
  return (await res.json()) as { id: string; status: string }
}
