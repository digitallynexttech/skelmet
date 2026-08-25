import { resetStaffPassword } from "@/features/settings/server/settings.service"
import { respond } from "@/lib/api-response"
import { withErrorHandler } from "@/server/api-handler"

export const dynamic = "force-dynamic"

export const POST = withErrorHandler<{ id: string }>(async (req, { params }) =>
  respond(await resetStaffPassword(params.id, await req.json())),
)
