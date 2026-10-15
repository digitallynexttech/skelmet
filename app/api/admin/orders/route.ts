import { z } from "zod"

import { ORDER_VIEW_KEYS } from "@/features/orders/order-views"
import { listOrders } from "@/features/orders/server/orders.service"
import { respond } from "@/lib/api-response"
import { ORDER_STATUSES } from "@/lib/constants"
import { withErrorHandler } from "@/server/api-handler"
import { enumParam, listParams, pageParam, pageSizeParam, textParam } from "@/server/list-params"

export const dynamic = "force-dynamic"

const QUERY = {
  page: pageParam,
  pageSize: pageSizeParam,
  scope: enumParam(["paid", "all"], "paid"),
  status: enumParam(["ALL", ...ORDER_STATUSES], "ALL"),
  view: enumParam(ORDER_VIEW_KEYS, "all"),
  q: textParam,
  // Days back from now; 0 is all time.
  days: z.preprocess(
    (v) => (v === null || v === "" ? undefined : v),
    z.coerce.number().int().min(0).max(3_650).optional(),
  ),
}

export const GET = withErrorHandler(async (req) =>
  respond(await listOrders(listParams(req.nextUrl.searchParams, QUERY))),
)
