import type { Metadata } from "next"

import { OrderDetailView } from "@/features/orders/components/order-detail"

export const metadata: Metadata = {
  title: "Order",
  description:
    "One order: what was bought, the payment, the shipment and everything that has happened to it.",
}

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <OrderDetailView id={id} />
}
