import { getProductBySlug } from "@/features/catalog/server/catalog.service"
import { respond } from "@/lib/api-response"
import { withErrorHandler } from "@/server/api-handler"

// Pass the param type, or noUncheckedIndexedAccess makes `params.slug` possibly undefined.
export const GET = withErrorHandler<{ slug: string }>(async (_req, { params }) =>
  respond(await getProductBySlug(params.slug)),
)
