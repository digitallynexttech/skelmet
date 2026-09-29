import { unsubscribe } from "@/features/newsletter/server/newsletter.service"
import { respond } from "@/lib/api-response"
import { clientIp, rateLimit } from "@/lib/rate-limit"
import { withErrorHandler } from "@/server/api-handler"

export const dynamic = "force-dynamic"

/**
 * The token rides in the query string for both callers: the unsubscribe page,
 * and a mail client's one-click unsubscribe (RFC 8058), which posts a form
 * body of its own that says nothing about who is leaving.
 */
export const POST = withErrorHandler(async (req) => {
  rateLimit(`unsubscribe:${clientIp(req.headers)}`, 30, 10 * 60_000)
  return respond(await unsubscribe({ token: req.nextUrl.searchParams.get("token") ?? "" }))
})
