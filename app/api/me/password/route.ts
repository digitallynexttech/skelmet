import { changeOwnPassword } from "@/features/account/server/password.service"
import { respond } from "@/lib/api-response"
import { clientIp, rateLimit } from "@/lib/rate-limit"
import { withErrorHandler } from "@/server/api-handler"

export const dynamic = "force-dynamic"

/**
 * One expression. No try/catch, no db, no NextResponse.json (§5).
 *
 * Not under /api/account: proxy.ts fences that prefix to CUSTOMER, and staff
 * are the population most likely to be here. The service requires a session.
 */
export const POST = withErrorHandler(async (req) => {
  rateLimit(`password:${clientIp(req.headers)}`, 10, 10 * 60_000)
  return respond(await changeOwnPassword(await req.json()))
})
