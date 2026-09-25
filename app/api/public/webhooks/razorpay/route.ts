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
  const result = await applyPaymentWebhook(event)

  // A delivery we could not save answers 500, so Razorpay retries it - that
  // retry is the only thing that recovers a capture lost to a database blip.
  // It used to answer 200 regardless, telling Razorpay the payment was
  // recorded when it was not. Safe to retry: capturePayment claims once, so a
  // redelivery of something already saved does nothing and answers 200.
  // Events we simply do not act on are ok({ handled: false }), still 200.
  if (!result.ok) {
    console.error("[WEBHOOK] could not apply", event.event, result.error)
    return NextResponse.json({ success: false }, { status: 500 })
  }
  return NextResponse.json({ success: true })
})
