import { listCartOffers } from "@/features/coupons/server/coupons.service"
import { respond } from "@/lib/api-response"
import { clientIp, rateLimit } from "@/lib/rate-limit"
import { withErrorHandler } from "@/server/api-handler"

export const dynamic = "force-dynamic"

/**
 * The codes staff chose to offer in the cart. Public, asked each time the
 * cart drawer opens, so rate-limited.
 */
export const GET = withErrorHandler(async (req) => {
  rateLimit(`offers:${clientIp(req.headers)}`, 60, 10 * 60_000)
  return respond(await listCartOffers())
})
