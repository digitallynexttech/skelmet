import "server-only"

import { createHmac, timingSafeEqual } from "node:crypto"

import {
  PAYMENT_MODES,
  type PaymentMode,
} from "@/features/settings/schemas/runtime-settings.schema"
import { paymentConfig, type PaymentConfig } from "@/features/settings/server/runtime-settings"
import { AppError } from "@/lib/errors"

/**
 * Razorpay, over their REST API directly - the SDK is a thin wrapper over these
 * three calls and adds a dependency we do not need.
 *
 * Money crosses this boundary in PAISE (integer). Everywhere else in the app it
 * is rupees as a Decimal/string, so convert at exactly this edge and nowhere
 * else.
 *
 * The keys come from the console's Settings, falling back to .env, and there
 * are two sets: test and live. New payments go to whichever account is
 * switched on. Everything done to an existing payment - verifying it,
 * refunding it - uses the account that took it, which its row records, so a
 * switch never strands the payments made before it.
 */

const API = "https://api.razorpay.com/v1"

type RazorpayOrder = {
  id: string
  amount: number
  currency: string
  receipt: string
  status: string
}

/**
 * The account a payment row belongs to. Rows from before the switch existed
 * carry no mode; they were all made with .env's keys.
 */
export function modeOfPayment(
  mode: string | null | undefined,
  config: Pick<PaymentConfig, "envMode" | "mode">,
): PaymentMode {
  return PAYMENT_MODES.find((m) => m === mode) ?? config.envMode ?? config.mode
}

async function credentials(mode?: PaymentMode): Promise<{
  mode: PaymentMode
  keyId: string
  keySecret: string
}> {
  const config = await paymentConfig()
  const use = mode ?? config.mode
  const { keyId, keySecret } = config[use]
  if (!keyId || !keySecret) {
    throw new AppError(
      mode ? `The Razorpay ${use} keys are not set.` : "Payments are not configured yet.",
      503,
      "GATEWAY_UNCONFIGURED",
    )
  }
  return { mode: use, keyId, keySecret }
}

function basic(keyId: string, keySecret: string): string {
  return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`
}

/** Whether the account switched on has a key id and secret. */
export async function isGatewayConfigured(): Promise<boolean> {
  const config = await paymentConfig()
  const keys = config[config.mode]
  return Boolean(keys.keyId && keys.keySecret)
}

export function toPaise(rupees: number | string): number {
  return Math.round(Number(rupees) * 100)
}

/**
 * Opens a Razorpay order on the account switched on. Returns the publishable
 * key id the browser opens checkout with - it must be that same account's -
 * and the mode, for the payment row.
 */
export async function createGatewayOrder(input: {
  amountRupees: number | string
  receipt: string
  notes?: Record<string, string>
}): Promise<{ order: RazorpayOrder; keyId: string; mode: PaymentMode }> {
  const { mode, keyId, keySecret } = await credentials()

  const res = await fetch(`${API}/orders`, {
    method: "POST",
    headers: {
      authorization: basic(keyId, keySecret),
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
    console.error("[RAZORPAY] order create failed", mode, res.status, detail)
    throw new AppError("Could not start the payment. Try again.", 502, "GATEWAY_ERROR")
  }

  return { order: (await res.json()) as RazorpayOrder, keyId, mode }
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8")
  const bufB = Buffer.from(b, "utf8")
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB)
}

/**
 * Verifies the handler payload the browser returns after a successful payment,
 * against the secret of the account the payment was opened on.
 * Signature = HMAC_SHA256(`${orderId}|${paymentId}`, keySecret).
 */
export async function verifyPaymentSignature(
  input: { gatewayOrderId: string; gatewayPaymentId: string; signature: string },
  mode: PaymentMode,
): Promise<boolean> {
  const { keySecret } = (await paymentConfig())[mode]
  if (!keySecret) return false
  const expected = createHmac("sha256", keySecret)
    .update(`${input.gatewayOrderId}|${input.gatewayPaymentId}`)
    .digest("hex")
  return safeEqual(expected, input.signature)
}

/**
 * Verifies a webhook. Signature = HMAC_SHA256(rawBody, webhookSecret), so the
 * route must hand us the raw text, never a re-serialised object.
 *
 * Tried against both accounts' webhook secrets: a test payment still in flight
 * when the console switches to live is still delivered, signed with the test
 * secret. Both are ours, so either proves the delivery came from Razorpay.
 *
 * Fails closed when no secret is set (§6).
 */
export async function verifyWebhookSignature(
  rawBody: string,
  signature: string | null,
): Promise<boolean> {
  if (!signature) return false
  const config = await paymentConfig()
  const secrets = PAYMENT_MODES.map((m) => config[m].webhookSecret).filter((s): s is string =>
    Boolean(s),
  )
  return secrets.some((secret) =>
    safeEqual(createHmac("sha256", secret).update(rawBody).digest("hex"), signature),
  )
}

/**
 * Whether Razorpay accepts a key pair - one read of the account's orders,
 * which creates nothing. For the console's "Test keys".
 */
export async function checkGatewayKeys(mode: PaymentMode): Promise<void> {
  const { keyId, keySecret } = await credentials(mode)
  let res: Response
  try {
    res = await fetch(`${API}/orders?count=1`, {
      headers: { authorization: basic(keyId, keySecret) },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    })
  } catch {
    throw new AppError("Razorpay did not answer. Try again in a moment.", 504, "GATEWAY_ERROR")
  }
  if (res.status === 401) {
    throw new AppError(`Razorpay refused the ${mode} key id and secret.`, 422, "GATEWAY_KEYS")
  }
  if (!res.ok) {
    throw new AppError(`Razorpay answered HTTP ${res.status}.`, 502, "GATEWAY_ERROR")
  }
}

export async function fetchPayment(
  paymentId: string,
  mode: PaymentMode,
): Promise<{
  id: string
  status: string
  amount: number
  method?: string
}> {
  const { keyId, keySecret } = await credentials(mode)

  const res = await fetch(`${API}/payments/${paymentId}`, {
    headers: { authorization: basic(keyId, keySecret) },
    cache: "no-store",
  })
  if (!res.ok) throw new AppError("Could not read the payment.", 502, "GATEWAY_ERROR")
  return (await res.json()) as { id: string; status: string; amount: number; method?: string }
}

export async function refundPayment(input: {
  gatewayPaymentId: string
  amountRupees: number | string
  mode: PaymentMode
  notes?: Record<string, string>
}): Promise<{ id: string; status: string }> {
  const { keyId, keySecret } = await credentials(input.mode)

  const res = await fetch(`${API}/payments/${input.gatewayPaymentId}/refund`, {
    method: "POST",
    headers: { authorization: basic(keyId, keySecret), "content-type": "application/json" },
    body: JSON.stringify({ amount: toPaise(input.amountRupees), notes: input.notes ?? {} }),
    cache: "no-store",
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => "")
    console.error("[RAZORPAY] refund failed", input.mode, res.status, detail)
    throw new AppError("Refund could not be issued.", 502, "GATEWAY_ERROR")
  }
  return (await res.json()) as { id: string; status: string }
}
