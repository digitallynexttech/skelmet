import { listCustomers } from "@/features/customers/server/customers.service"
import { respond } from "@/lib/api-response"
import { withErrorHandler } from "@/server/api-handler"
import { listParams, pageParam, pageSizeParam, textParam } from "@/server/list-params"

export const dynamic = "force-dynamic"

const QUERY = { page: pageParam, pageSize: pageSizeParam, search: textParam }

export const GET = withErrorHandler(async (req) =>
  respond(await listCustomers(listParams(req.nextUrl.searchParams, QUERY))),
)
