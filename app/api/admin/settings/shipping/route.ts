import { saveShippingCharge } from "@/features/settings/server/runtime-settings.service"
import { respond } from "@/lib/api-response"
import { withErrorHandler } from "@/server/api-handler"

export const dynamic = "force-dynamic"

export const PATCH = withErrorHandler(async (req) =>
  respond(await saveShippingCharge(await req.json())),
)
