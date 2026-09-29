import { getNewsletterImage } from "@/features/newsletter/server/newsletter.service"
import { respondImage } from "@/lib/api-response"
import { withErrorHandler } from "@/server/api-handler"

export const dynamic = "force-dynamic"

/** A picture in a newsletter, as the subscribers' mail clients fetch it. */
export const GET = withErrorHandler<{ id: string }>(async (_req, { params }) =>
  respondImage(await getNewsletterImage(params.id)),
)
