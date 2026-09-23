import { createCoupon, listCoupons } from "@/features/coupons/server/coupons.service"
import { respond } from "@/lib/api-response"
import { withErrorHandler } from "@/server/api-handler"

export const dynamic = "force-dynamic"

export const GET = withErrorHandler(async (req) =>
  respond(
    await listCoupons({
      page: Number(req.nextUrl.searchParams.get("page") ?? 1),
        // The service caps this; an unbounded ?pageSize would let anyone
        // with console access pull the whole table in one query.
        pageSize: Number(req.nextUrl.searchParams.get("pageSize")) || undefined,
      q: req.nextUrl.searchParams.get("q"),
    }),
  ),
)

export const POST = withErrorHandler(async (req) =>
  respond(await createCoupon(await req.json()), 201),
)
