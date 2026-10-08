import { NextResponse } from "next/server"

import { applyPaymentWebhook } from "@/features/checkout/server/checkout.service"
import { verifyWebhookSignature } from "@/features/checkout/server/payment-gateway"
import { withErrorHandler } from "@/server/api-handler"

export const dynamic = "force-dynamic"

/**
 * Signature is HMAC over the RAW body, so read text() and never re-serialise.
 * Fails closed when no webhook secret is set, in Settings or .env.
 */
export const POST = withErrorHandler(async (req) => {
  const raw = await req.text()
  const signature = req.headers.get("x-razorpay-signature")

  if (!(await verifyWebhookSignature(raw, signature))) {
    console.error("[WEBHOOK] razorpay signature rejected")
    return NextResponse.json({ success: false }, { status: 401 })
  }

  const event = JSON.parse(raw) as Parameters<typeof applyPaymentWebhook>[0]
  const result = await applyPaymentWebhook(event)

  // Not saved: 500, so Razorpay retries (safe, capturePayment claims once).
  // Events we ignore are ok({ handled: false }), still 200.
  if (!result.ok) {
    console.error("[WEBHOOK] could not apply", event.event, result.error)
    return NextResponse.json({ success: false }, { status: 500 })
  }
  return NextResponse.json({ success: true })
})
