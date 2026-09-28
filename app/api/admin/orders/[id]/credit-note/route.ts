import { getCreditNotePdf } from "@/features/invoices/server/invoice.service"
import { respondPdf } from "@/lib/api-response"
import { withErrorHandler } from "@/server/api-handler"

export const dynamic = "force-dynamic"

/**
 * The credit note of a refunded order that had been invoiced. The first read
 * issues its number, so proxy.ts refuses this GET cross-site like a write.
 */
export const GET = withErrorHandler<{ id: string }>(async (_req, { params }) =>
  respondPdf(await getCreditNotePdf(params.id)),
)
