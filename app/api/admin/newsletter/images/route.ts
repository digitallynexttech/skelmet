import { uploadNewsletterImage } from "@/features/newsletter/server/newsletter.service"
import { respond } from "@/lib/api-response"
import { withErrorHandler } from "@/server/api-handler"

export const dynamic = "force-dynamic"

/** A picture for the editor. A body that is not a form reads as no file chosen. */
export const POST = withErrorHandler(async (req) =>
  respond(await uploadNewsletterImage(await req.formData().catch(() => new FormData())), 201),
)
