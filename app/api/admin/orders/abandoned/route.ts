import { listUnpaidOrders } from "@/features/orders/server/abandoned.service"
import { respond } from "@/lib/api-response"
import { withErrorHandler } from "@/server/api-handler"

export const dynamic = "force-dynamic"

/** Online orders placed and never paid for. */
export const GET = withErrorHandler(async () => respond(await listUnpaidOrders()))
