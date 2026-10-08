import { livePrices } from "@/features/catalog/server/catalog.service"
import { respond } from "@/lib/api-response"
import { clientIp, rateLimit } from "@/lib/rate-limit"
import { withErrorHandler } from "@/server/api-handler"

export const dynamic = "force-dynamic"

// Live price per SKU; the cart drawer refreshes saved lines with it on every open.
export const GET = withErrorHandler(async (req) => {
  rateLimit(`prices:${clientIp(req.headers)}`, 60, 10 * 60_000)
  return respond(await livePrices())
})
