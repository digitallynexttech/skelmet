import { confirmPayment } from "@/features/checkout/server/checkout.service"
import { respond } from "@/lib/api-response"
import { withErrorHandler } from "@/server/api-handler"

export const dynamic = "force-dynamic"

export const POST = withErrorHandler(async (req) => respond(await confirmPayment(await req.json())))
