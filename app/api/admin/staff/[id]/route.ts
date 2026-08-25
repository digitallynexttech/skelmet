import { revokeStaff, setStaffRoles } from "@/features/settings/server/settings.service"
import { respond } from "@/lib/api-response"
import { withErrorHandler } from "@/server/api-handler"

export const dynamic = "force-dynamic"

export const PATCH = withErrorHandler<{ id: string }>(async (req, { params }) =>
  respond(await setStaffRoles(params.id, await req.json())),
)

export const DELETE = withErrorHandler<{ id: string }>(async (_req, { params }) =>
  respond(await revokeStaff(params.id)),
)
