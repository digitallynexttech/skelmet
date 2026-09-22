import { createStaff, listStaff } from "@/features/settings/server/settings.service"
import { respond } from "@/lib/api-response"
import { withErrorHandler } from "@/server/api-handler"

export const dynamic = "force-dynamic"

export const GET = withErrorHandler(async () => respond(await listStaff()))

export const POST = withErrorHandler(async (req) =>
  respond(await createStaff(await req.json()), 201),
)
