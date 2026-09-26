import { getInvoicePdf } from "@/features/invoices/server/invoice.service"
import { respondPdf } from "@/lib/api-response"
import { withErrorHandler } from "@/server/api-handler"

export const dynamic = "force-dynamic"

export const GET = withErrorHandler<{ id: string }>(async (_req, { params }) =>
  respondPdf(await getInvoicePdf(params.id)),
)
