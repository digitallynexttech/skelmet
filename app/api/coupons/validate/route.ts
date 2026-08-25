import { validateCoupon } from "@/features/coupons/server/coupons.service"
import { respond } from "@/lib/api-response"
import { clientIp, rateLimit } from "@/lib/rate-limit"
import { withErrorHandler } from "@/server/api-handler"

export const dynamic = "force-dynamic"

export const POST = withErrorHandler(async (req) => {
  rateLimit(`coupon:${clientIp(req.headers)}`, 20, 10 * 60_000)
  return respond(await validateCoupon(await req.json()))
})
