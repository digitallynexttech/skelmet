import { bookShipment } from "@/features/shipping/server/shipping.service"
import { respond } from "@/lib/api-response"
import { withErrorHandler } from "@/server/api-handler"

export const dynamic = "force-dynamic"

/** Books the courier through Shiprocket. An empty body lets Shiprocket choose. */
export const POST = withErrorHandler<{ id: string }>(async (req, { params }) =>
  respond(await bookShipment(params.id, await req.json().catch(() => ({})))),
)
