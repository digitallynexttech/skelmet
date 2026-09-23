import { trackOrder } from "@/features/orders/server/track.service"
import { respond } from "@/lib/api-response"
import { clientIp, rateLimit } from "@/lib/rate-limit"
import { withErrorHandler } from "@/server/api-handler"

export const dynamic = "force-dynamic"

/**
 * One expression. No try/catch, no db, no NextResponse.json (§5).
 *
 * Tighter than the other public endpoints: order number plus email is a
 * guessable pair, so this is the one route where the rate limit is part of the
 * authorisation rather than just abuse control. Ten tries per ten minutes is
 * more than a customer who mistypes twice will ever need.
 */
export const POST = withErrorHandler(async (req) => {
  rateLimit(`track:${clientIp(req.headers)}`, 10, 10 * 60_000)
  return respond(await trackOrder(await req.json()))
})
