import { getCheckoutPrefill } from "@/features/checkout/server/prefill.service"
import { respond } from "@/lib/api-response"
import { withErrorHandler } from "@/server/api-handler"

/**
 * Not under /api/admin: this hands the buyer's own last order back to the
 * browser that placed it. The httpOnly cookie is the entire authorisation -
 * nothing in the request can widen what it returns.
 */
export const dynamic = "force-dynamic"

export const GET = withErrorHandler(async () => respond(await getCheckoutPrefill()))
