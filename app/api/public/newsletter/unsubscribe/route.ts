import { unsubscribe } from "@/features/newsletter/server/newsletter.service"
import { respond } from "@/lib/api-response"
import { clientIp, rateLimit } from "@/lib/rate-limit"
import { withErrorHandler } from "@/server/api-handler"

export const dynamic = "force-dynamic"

// Token in the query string: RFC 8058 one-click posts its own body, without it.
export const POST = withErrorHandler(async (req) => {
  rateLimit(`unsubscribe:${clientIp(req.headers)}`, 30, 10 * 60_000)
  return respond(await unsubscribe({ token: req.nextUrl.searchParams.get("token") ?? "" }))
})
