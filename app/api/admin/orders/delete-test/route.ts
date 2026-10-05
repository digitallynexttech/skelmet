import { deleteTestOrders } from "@/features/orders/server/test-orders"
import { respond } from "@/lib/api-response"
import { withErrorHandler } from "@/server/api-handler"

export const dynamic = "force-dynamic"

/** Without `confirm`, says what would be deleted and what kept; with it, deletes. */
export const POST = withErrorHandler(async (req) =>
  respond(await deleteTestOrders(await req.json())),
)
