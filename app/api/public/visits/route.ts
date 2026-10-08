import { recordVisit } from "@/features/visitors/server/tracking.service"
import { respond } from "@/lib/api-response"
import { clientIp, rateLimit } from "@/lib/rate-limit"
import { withErrorHandler } from "@/server/api-handler"

export const dynamic = "force-dynamic"

// Visit tracker, generously rate-limited (a message per page and tab switch). Parsed as JSON
// whatever the label: sendBeacon sends text/plain.
export const POST = withErrorHandler(async (req) => {
  rateLimit(`visits:${clientIp(req.headers)}`, 300, 10 * 60_000)
  return respond(await recordVisit(await req.json()))
})
