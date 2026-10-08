import { listCartOffers } from "@/features/coupons/server/coupons.service"
import { respond } from "@/lib/api-response"
import { clientIp, rateLimit } from "@/lib/rate-limit"
import { withErrorHandler } from "@/server/api-handler"

export const dynamic = "force-dynamic"

// Codes offered in the cart; fetched on every drawer open.
export const GET = withErrorHandler(async (req) => {
  rateLimit(`offers:${clientIp(req.headers)}`, 60, 10 * 60_000)
  return respond(await listCartOffers())
})
