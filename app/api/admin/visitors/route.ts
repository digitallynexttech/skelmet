import { z } from "zod"

import { listVisitors } from "@/features/visitors/server/visitors.service"
import { respond } from "@/lib/api-response"
import { withErrorHandler } from "@/server/api-handler"
import { enumParam, listParams, textParam } from "@/server/list-params"

export const dynamic = "force-dynamic"

const QUERY = {
  view: enumParam(["all", "known", "anonymous", "contact", "cart", "bought"], "all"),
  q: textParam,
  // Days back from now; 0 is all time.
  days: z.preprocess(
    (v) => (v === null || v === "" ? undefined : v),
    z.coerce.number().int().min(0).max(3_650).optional(),
  ),
}

export const GET = withErrorHandler(async (req) =>
  respond(await listVisitors(listParams(req.nextUrl.searchParams, QUERY))),
)
