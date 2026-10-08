import { inStockSkus } from "@/features/catalog/server/catalog.service"
import { respond } from "@/lib/api-response"
import { clientIp, rateLimit } from "@/lib/rate-limit"
import { withErrorHandler } from "@/server/api-handler"

export const dynamic = "force-dynamic"

// SKUs on sale with stock; the cart drawer suggests only these.
export const GET = withErrorHandler(async (req) => {
  rateLimit(`in-stock:${clientIp(req.headers)}`, 60, 10 * 60_000)
  return respond(await inStockSkus())
})
