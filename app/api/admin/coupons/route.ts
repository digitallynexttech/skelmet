import { createCoupon, listCoupons } from "@/features/coupons/server/coupons.service"
import { respond } from "@/lib/api-response"
import { withErrorHandler } from "@/server/api-handler"
import { listParams, pageParam, pageSizeParam, textParam } from "@/server/list-params"

export const dynamic = "force-dynamic"

const QUERY = { page: pageParam, pageSize: pageSizeParam, q: textParam }

export const GET = withErrorHandler(async (req) =>
  respond(await listCoupons(listParams(req.nextUrl.searchParams, QUERY))),
)

export const POST = withErrorHandler(async (req) =>
  respond(await createCoupon(await req.json()), 201),
)
