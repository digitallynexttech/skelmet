import { listCustomers } from "@/features/customers/server/customers.service"
import { respond } from "@/lib/api-response"
import { withErrorHandler } from "@/server/api-handler"

export const dynamic = "force-dynamic"

export const GET = withErrorHandler(async (req) =>
  respond(
    await listCustomers({
      page: Number(req.nextUrl.searchParams.get("page") ?? 1),
      pageSize: Number(req.nextUrl.searchParams.get("pageSize") ?? 20),
      search: req.nextUrl.searchParams.get("search") ?? undefined,
    }),
  ),
)
