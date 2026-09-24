import { getCustomer } from "@/features/customers/server/customers.service"
import { respond } from "@/lib/api-response"
import { withErrorHandler } from "@/server/api-handler"

export const dynamic = "force-dynamic"

export const GET = withErrorHandler<{ id: string }>(async (_req, { params }) =>
  respond(await getCustomer(params.id)),
)
