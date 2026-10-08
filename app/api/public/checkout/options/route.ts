import { getCheckoutOptions } from "@/features/checkout/server/payment-options.service"
import { respond } from "@/lib/api-response"
import { clientIp, rateLimit } from "@/lib/rate-limit"
import { withErrorHandler } from "@/server/api-handler"

export const dynamic = "force-dynamic"

// Payment options for `?pincode=110044&units=2` (pincode optional). With COD on, a pincode calls Shiprocket.
export const GET = withErrorHandler(async (req) => {
  rateLimit(`checkout-options:${clientIp(req.headers)}`, 40, 10 * 60_000)
  const params = req.nextUrl.searchParams
  return respond(
    await getCheckoutOptions({
      pincode: params.get("pincode") ?? undefined,
      units: params.get("units") ?? undefined,
    }),
  )
})
