import { trackOrder } from "@/features/orders/server/track.service"
import { respond } from "@/lib/api-response"
import { clientIp, rateLimit } from "@/lib/rate-limit"
import { withErrorHandler } from "@/server/api-handler"

export const dynamic = "force-dynamic"

// Order number + email is guessable, so this tight limit is part of the authorisation.
export const POST = withErrorHandler(async (req) => {
  rateLimit(`track:${clientIp(req.headers)}`, 10, 10 * 60_000)
  return respond(await trackOrder(await req.json()))
})
