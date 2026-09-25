import { applyShippingWebhook } from "@/features/shipping/server/shipping.service"
import { respond } from "@/lib/api-response"
import { withErrorHandler } from "@/server/api-handler"

export const dynamic = "force-dynamic"

/**
 * Shiprocket's tracking webhook (Settings > API > Webhooks).
 *
 * Named "shipping" on purpose: Shiprocket refuses a webhook URL containing
 * "shiprocket", "kartrocket", "sr" or "kr". It sends the shared token as
 * `x-api-key`, and expects a 200 back every time - the service always answers
 * ok, and simply ignores an update without the token.
 */
export const POST = withErrorHandler(async (req) =>
  respond(await applyShippingWebhook(req.headers.get("x-api-key"), await req.text())),
)
