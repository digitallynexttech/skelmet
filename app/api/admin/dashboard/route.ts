import { getDashboard } from "@/features/orders/server/orders.service"
import { respond } from "@/lib/api-response"
import { withErrorHandler } from "@/server/api-handler"

export const dynamic = "force-dynamic"

export const GET = withErrorHandler(async () => respond(await getDashboard()))
