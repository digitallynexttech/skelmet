import { listVisitors } from "@/features/visitors/server/visitors.service"
import { respond } from "@/lib/api-response"
import { withErrorHandler } from "@/server/api-handler"

export const dynamic = "force-dynamic"

export const GET = withErrorHandler(async (req) =>
  respond(
    await listVisitors({
      view: req.nextUrl.searchParams.get("view"),
      q: req.nextUrl.searchParams.get("q"),
      days: req.nextUrl.searchParams.get("days"),
    }),
  ),
)
