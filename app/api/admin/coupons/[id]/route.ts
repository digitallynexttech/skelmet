import {
  expireCoupon,
  getCouponHistory,
  updateCoupon,
} from "@/features/coupons/server/coupons.service"
import { respond } from "@/lib/api-response"
import { withErrorHandler } from "@/server/api-handler"

export const dynamic = "force-dynamic"

/** The code with its runs, its orders and its log. */
export const GET = withErrorHandler<{ id: string }>(async (_req, { params }) =>
  respond(await getCouponHistory({ id: params.id })),
)

export const PATCH = withErrorHandler<{ id: string }>(async (req, { params }) =>
  respond(await updateCoupon(params.id, await req.json())),
)

export const DELETE = withErrorHandler<{ id: string }>(async (_req, { params }) =>
  respond(await expireCoupon(params.id)),
)
