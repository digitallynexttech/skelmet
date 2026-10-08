import { getCheckoutPrefill } from "@/features/checkout/server/prefill.service"
import { respond } from "@/lib/api-response"
import { clientIp, rateLimit } from "@/lib/rate-limit"
import { withErrorHandler } from "@/server/api-handler"

// The buyer's own last order, back to the browser that placed it. The httpOnly cookie is the
// whole authorisation: nothing in the request can widen it.
export const dynamic = "force-dynamic"

export const GET = withErrorHandler(async (req) => {
  rateLimit(`prefill:${clientIp(req.headers)}`, 30, 10 * 60_000)
  return respond(await getCheckoutPrefill())
})
