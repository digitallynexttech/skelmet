import { listProducts } from "@/features/catalog/server/catalog.service"
import { respond } from "@/lib/api-response"
import { withErrorHandler } from "@/server/api-handler"

export const GET = withErrorHandler(async () => respond(await listProducts()))
