import { schedulePost } from "@/features/blog/server/blog.service"
import { respond } from "@/lib/api-response"
import { withErrorHandler } from "@/server/api-handler"

export const dynamic = "force-dynamic"

export const POST = withErrorHandler<{ id: string }>(async (req, { params }) =>
  respond(await schedulePost(params.id, await req.json())),
)
