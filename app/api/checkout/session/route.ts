import { placeOrder } from "@/features/checkout/server/checkout.service"
import { respond } from "@/lib/api-response"
import { clientIp, rateLimit } from "@/lib/rate-limit"
import { withErrorHandler } from "@/server/api-handler"

export const dynamic = "force-dynamic"

export const POST = withErrorHandler(async (req) => {
  rateLimit(`checkout:${clientIp(req.headers)}`, 12, 10 * 60_000)
  return respond(await placeOrder(await req.json()), 201)
})
