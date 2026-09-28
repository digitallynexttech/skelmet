import { listInquiries } from "@/features/inquiries/server/inquiries.service"
import { respond } from "@/lib/api-response"
import { withErrorHandler } from "@/server/api-handler"
import { enumParam, listParams, pageParam, pageSizeParam, textParam } from "@/server/list-params"

export const dynamic = "force-dynamic"

const QUERY = {
  page: pageParam,
  pageSize: pageSizeParam,
  status: enumParam(["ALL", "NEW", "OPEN", "RESOLVED"], "ALL"),
  q: textParam,
}

export const GET = withErrorHandler(async (req) =>
  respond(await listInquiries(listParams(req.nextUrl.searchParams, QUERY))),
)
