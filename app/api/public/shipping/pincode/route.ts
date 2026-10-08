import { checkPincode } from "@/features/shipping/server/shipping.service"
import { respond } from "@/lib/api-response"
import { clientIp, rateLimit } from "@/lib/rate-limit"
import { withErrorHandler } from "@/server/api-handler"

export const dynamic = "force-dynamic"

// Delivery check and shipping fee: `?pincode=110044&units=2`. Each cache miss calls Shiprocket.
export const GET = withErrorHandler(async (req) => {
  rateLimit(`pincode:${clientIp(req.headers)}`, 30, 10 * 60_000)
  const params = req.nextUrl.searchParams
  return respond(
    await checkPincode({
      pincode: params.get("pincode") ?? "",
      units: params.get("units") ?? undefined,
    }),
  )
})
