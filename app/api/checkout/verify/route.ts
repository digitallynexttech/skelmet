import { confirmPayment } from "@/features/checkout/server/checkout.service"
import { respond } from "@/lib/api-response"
import { clientIp, rateLimit } from "@/lib/rate-limit"
import { withErrorHandler } from "@/server/api-handler"

export const dynamic = "force-dynamic"

/**
 * Rate-limited like every public endpoint (§6): each call checks a
 * signature, reads the payment back from Razorpay and may write an audit
 * row, so an unlimited loop of forged confirmations was free to send.
 */
export const POST = withErrorHandler(async (req) => {
  rateLimit(`verify:${clientIp(req.headers)}`, 30, 10 * 60_000)
  return respond(await confirmPayment(await req.json()))
})
