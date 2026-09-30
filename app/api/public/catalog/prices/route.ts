import { livePrices } from "@/features/catalog/server/catalog.service"
import { respond } from "@/lib/api-response"
import { clientIp, rateLimit } from "@/lib/rate-limit"
import { withErrorHandler } from "@/server/api-handler"

export const dynamic = "force-dynamic"

/**
 * The live price of every colourway, keyed by SKU. The cart drawer asks each
 * time it opens, to bring lines saved at an older price up to date. Public,
 * and a database read, so rate-limited.
 */
export const GET = withErrorHandler(async (req) => {
  rateLimit(`prices:${clientIp(req.headers)}`, 60, 10 * 60_000)
  return respond(await livePrices())
})
