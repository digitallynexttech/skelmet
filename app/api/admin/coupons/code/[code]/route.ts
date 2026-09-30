import { getCouponHistory } from "@/features/coupons/server/coupons.service"
import { respond } from "@/lib/api-response"
import { withErrorHandler } from "@/server/api-handler"

export const dynamic = "force-dynamic"

/** A code's history, found by the code itself: what /admin/coupons/DIWALI200 asks for. */
export const GET = withErrorHandler<{ code: string }>(async (_req, { params }) =>
  respond(await getCouponHistory({ code: decodeURIComponent(params.code) })),
)
