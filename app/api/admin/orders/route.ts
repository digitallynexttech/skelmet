import type { OrderStatus } from "@/lib/constants"
import { listOrders } from "@/features/orders/server/orders.service"
import { respond } from "@/lib/api-response"
import { withErrorHandler } from "@/server/api-handler"

export const dynamic = "force-dynamic"

export const GET = withErrorHandler(async (req) =>
  respond(
    await listOrders({
      page: Number(req.nextUrl.searchParams.get("page") ?? 1),
      status: (req.nextUrl.searchParams.get("status") ?? "ALL") as OrderStatus | "ALL",
      q: req.nextUrl.searchParams.get("q"),
    }),
  ),
)
