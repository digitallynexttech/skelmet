import { subscribe } from "@/features/newsletter/server/newsletter.service"
import { respond } from "@/lib/api-response"
import { clientIp, rateLimit } from "@/lib/rate-limit"
import { withErrorHandler } from "@/server/api-handler"

export const dynamic = "force-dynamic"

/** The home page's "Notify me". */
export const POST = withErrorHandler(async (req) => {
  rateLimit(`newsletter:${clientIp(req.headers)}`, 5, 10 * 60_000)
  return respond(await subscribe(await req.json()), 201)
})
