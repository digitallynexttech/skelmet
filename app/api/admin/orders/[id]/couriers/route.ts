import { getCourierOptions } from "@/features/shipping/server/shipping.service"
import { respond } from "@/lib/api-response"
import { withErrorHandler } from "@/server/api-handler"

export const dynamic = "force-dynamic"

/** Couriers that deliver this order, with rates and Shiprocket's pick. */
export const GET = withErrorHandler<{ id: string }>(async (_req, { params }) =>
  respond(await getCourierOptions(params.id)),
)
