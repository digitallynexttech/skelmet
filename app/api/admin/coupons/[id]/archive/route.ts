import { setCouponArchived } from "@/features/coupons/server/coupons.service"
import { respond } from "@/lib/api-response"
import { withErrorHandler } from "@/server/api-handler"

export const dynamic = "force-dynamic"

/** POST archives the code; DELETE takes it out of the archive again. */
export const POST = withErrorHandler<{ id: string }>(async (_req, { params }) =>
  respond(await setCouponArchived(params.id, true)),
)

export const DELETE = withErrorHandler<{ id: string }>(async (_req, { params }) =>
  respond(await setCouponArchived(params.id, false)),
)
