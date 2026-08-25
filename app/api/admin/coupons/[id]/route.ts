import { expireCoupon, updateCoupon } from "@/features/coupons/server/coupons.service"
import { respond } from "@/lib/api-response"
import { withErrorHandler } from "@/server/api-handler"

export const dynamic = "force-dynamic"

export const PATCH = withErrorHandler<{ id: string }>(async (req, { params }) =>
  respond(await updateCoupon(params.id, await req.json())),
)

export const DELETE = withErrorHandler<{ id: string }>(async (_req, { params }) =>
  respond(await expireCoupon(params.id)),
)
