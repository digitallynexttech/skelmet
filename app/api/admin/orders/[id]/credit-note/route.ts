import { getCreditNotePdf } from "@/features/invoices/server/invoice.service"
import { respondPdf } from "@/lib/api-response"
import { withErrorHandler } from "@/server/api-handler"

export const dynamic = "force-dynamic"

// The first GET issues a number, so proxy.ts refuses it cross-site like a write.
export const GET = withErrorHandler<{ id: string }>(async (_req, { params }) =>
  respondPdf(await getCreditNotePdf(params.id)),
)
