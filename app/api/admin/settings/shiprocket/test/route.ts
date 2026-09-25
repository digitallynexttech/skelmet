import { testShiprocket } from "@/features/settings/server/runtime-settings.service"
import { respond } from "@/lib/api-response"
import { withErrorHandler } from "@/server/api-handler"

export const dynamic = "force-dynamic"

export const POST = withErrorHandler(async () => respond(await testShiprocket()))
