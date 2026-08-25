import { createInquiry } from "@/features/inquiries/server/inquiries.service"
import { respond } from "@/lib/api-response"
import { clientIp, rateLimit } from "@/lib/rate-limit"
import { withErrorHandler } from "@/server/api-handler"

export const dynamic = "force-dynamic"

/** One expression. No try/catch, no db, no NextResponse.json (§5). */
export const POST = withErrorHandler(async (req) => {
  rateLimit(`contact:${clientIp(req.headers)}`, 5, 10 * 60_000)
  return respond(await createInquiry(await req.json()), 201)
})
