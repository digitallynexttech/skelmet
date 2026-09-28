import { getCheckoutPrefill } from "@/features/checkout/server/prefill.service"
import { respond } from "@/lib/api-response"
import { clientIp, rateLimit } from "@/lib/rate-limit"
import { withErrorHandler } from "@/server/api-handler"

/**
 * Not under /api/admin: this hands the buyer's own last order back to the
 * browser that placed it. The httpOnly cookie is the entire authorisation -
 * nothing in the request can widen what it returns. Rate-limited all the
 * same, as every public endpoint is (§6).
 */
export const dynamic = "force-dynamic"

export const GET = withErrorHandler(async (req) => {
  rateLimit(`prefill:${clientIp(req.headers)}`, 30, 10 * 60_000)
  return respond(await getCheckoutPrefill())
})
