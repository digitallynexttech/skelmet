import { applyShippingWebhook } from "@/features/shipping/server/shipping.service"
import { respond } from "@/lib/api-response"
import { withErrorHandler } from "@/server/api-handler"

export const dynamic = "force-dynamic"

// Shiprocket tracking webhook. Not named "shiprocket": it refuses URLs containing that, "sr"
// or "kr". Token comes as `x-api-key`; always answers 200, ignoring updates without it.
export const POST = withErrorHandler(async (req) =>
  respond(await applyShippingWebhook(req.headers.get("x-api-key"), await req.text())),
)
