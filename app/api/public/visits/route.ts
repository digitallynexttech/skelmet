import { recordVisit } from "@/features/visitors/server/tracking.service"
import { respond } from "@/lib/api-response"
import { clientIp, rateLimit } from "@/lib/rate-limit"
import { withErrorHandler } from "@/server/api-handler"

export const dynamic = "force-dynamic"

/**
 * The storefront's visit tracker: page views, time on page, the cart, and the
 * visitor's cookie choice. Public, so rate-limited - generously, since one
 * person browsing sends a message for every page and every tab switch.
 *
 * The body is read as JSON whatever it is labelled: the last message from a
 * closing page goes by navigator.sendBeacon, which sends it as text/plain.
 */
export const POST = withErrorHandler(async (req) => {
  rateLimit(`visits:${clientIp(req.headers)}`, 300, 10 * 60_000)
  return respond(await recordVisit(await req.json()))
})
