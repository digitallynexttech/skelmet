import type { Metadata } from "next"

import { CustomerDetailView } from "@/features/customers/components/customer-detail"

export const metadata: Metadata = {
  title: "Customer",
  description: "One customer: their orders, contact details and addresses.",
}

export default async function AdminCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <CustomerDetailView id={id} />
}
