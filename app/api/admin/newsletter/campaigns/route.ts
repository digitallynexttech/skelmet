import { listCampaigns, sendCampaign } from "@/features/newsletter/server/newsletter.service"
import { respond } from "@/lib/api-response"
import { withErrorHandler } from "@/server/api-handler"

export const dynamic = "force-dynamic"

export const GET = withErrorHandler(async () => respond(await listCampaigns()))

/** A test to the sender, or the real thing to everyone subscribed. */
export const POST = withErrorHandler(async (req) => respond(await sendCampaign(await req.json())))
