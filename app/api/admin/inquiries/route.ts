import { listInquiries } from "@/features/inquiries/server/inquiries.service"
import { respond } from "@/lib/api-response"
import { withErrorHandler } from "@/server/api-handler"

export const dynamic = "force-dynamic"

export const GET = withErrorHandler(async (req) =>
  respond(
    await listInquiries({
      page: Number(req.nextUrl.searchParams.get("page") ?? 1),
      status: req.nextUrl.searchParams.get("status"),
      q: req.nextUrl.searchParams.get("q"),
    }),
  ),
)
