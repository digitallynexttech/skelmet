import { renewCoupon } from "@/features/coupons/server/coupons.service"
import { respond } from "@/lib/api-response"
import { withErrorHandler } from "@/server/api-handler"

export const dynamic = "force-dynamic"

/** Runs an expired, used-up or archived code again with new terms. */
export const POST = withErrorHandler<{ id: string }>(async (req, { params }) =>
  respond(await renewCoupon(params.id, await req.json())),
)
