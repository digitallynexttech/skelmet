import { NextResponse } from "next/server"

import { applyPaymentWebhook } from "@/features/checkout/server/checkout.service"
import { verifyWebhookSignature } from "@/features/checkout/server/payment-gateway"
import { withErrorHandler } from "@/server/api-handler"

export const dynamic = "force-dynamic"

/**
 * Signature is HMAC over the RAW body, so read text() and never re-serialise.
 * Fails closed when PAYMENT_WEBHOOK_SECRET is unset.
 */
export const POST = withErrorHandler(async (req) => {
  const raw = await req.text()
  const signature = req.headers.get("x-razorpay-signature")

  if (!verifyWebhookSignature(raw, signature)) {
    console.error("[WEBHOOK] razorpay signature rejected")
    return NextResponse.json({ success: false }, { status: 401 })
  }

  const event = JSON.parse(raw) as Parameters<typeof applyPaymentWebhook>[0]
  await applyPaymentWebhook(event)

  // Always 200 once verified - a non-2xx makes Razorpay retry forever.
  return NextResponse.json({ success: true })
})
