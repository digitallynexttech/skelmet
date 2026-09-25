import { refreshTracking } from "@/features/shipping/server/shipping.service"
import { respond } from "@/lib/api-response"
import { withErrorHandler } from "@/server/api-handler"

export const dynamic = "force-dynamic"

/** Pulls the latest tracking from Shiprocket, for when a webhook was missed. */
export const POST = withErrorHandler<{ id: string }>(async (_req, { params }) =>
  respond(await refreshTracking(params.id)),
)
