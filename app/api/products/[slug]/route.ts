import { getProductBySlug } from "@/features/catalog/server/catalog.service"
import { respond } from "@/lib/api-response"
import { withErrorHandler } from "@/server/api-handler"

/**
 * Dynamic routes MUST pass the param type or `params.slug` is
 * `string | undefined` under noUncheckedIndexedAccess and the build fails (§5).
 */
export const GET = withErrorHandler<{ slug: string }>(async (_req, { params }) =>
  respond(await getProductBySlug(params.slug)),
)
