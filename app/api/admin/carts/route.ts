import { listLeftCarts } from "@/features/visitors/server/visitors.service"
import { respond } from "@/lib/api-response"
import { withErrorHandler } from "@/server/api-handler"

export const dynamic = "force-dynamic"

/** Baskets visitors filled and never placed an order from. */
export const GET = withErrorHandler(async () => respond(await listLeftCarts()))
