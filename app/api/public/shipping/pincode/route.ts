import { checkPincode } from "@/features/shipping/server/shipping.service"
import { respond } from "@/lib/api-response"
import { clientIp, rateLimit } from "@/lib/rate-limit"
import { withErrorHandler } from "@/server/api-handler"

export const dynamic = "force-dynamic"

/**
 * The product page's delivery check. Public, so rate-limited: each miss in the
 * cache is a call to Shiprocket on the shop's account.
 */
export const GET = withErrorHandler(async (req) => {
  rateLimit(`pincode:${clientIp(req.headers)}`, 30, 10 * 60_000)
  return respond(await checkPincode({ pincode: req.nextUrl.searchParams.get("pincode") ?? "" }))
})
