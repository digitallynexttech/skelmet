import { listReviews } from "@/features/reviews/server/reviews.service"
import { respond } from "@/lib/api-response"
import { withErrorHandler } from "@/server/api-handler"
import { enumParam, listParams, pageParam } from "@/server/list-params"

export const dynamic = "force-dynamic"

const QUERY = {
  page: pageParam,
  status: enumParam(["ALL", "PENDING", "PUBLISHED", "REJECTED"], "ALL"),
}

export const GET = withErrorHandler(async (req) =>
  respond(await listReviews(listParams(req.nextUrl.searchParams, QUERY))),
)
