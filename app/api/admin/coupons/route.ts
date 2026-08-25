import { createCoupon, listCoupons } from "@/features/coupons/server/coupons.service"
import { respond } from "@/lib/api-response"
import { withErrorHandler } from "@/server/api-handler"

export const dynamic = "force-dynamic"

export const GET = withErrorHandler(async (req) =>
  respond(
    await listCoupons({
      page: Number(req.nextUrl.searchParams.get("page") ?? 1),
      q: req.nextUrl.searchParams.get("q"),
    }),
  ),
)

export const POST = withErrorHandler(async (req) => respond(await createCoupon(await req.json()), 201))
