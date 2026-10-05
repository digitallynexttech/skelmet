import type { Metadata } from "next"

import { CustomerTable } from "@/features/customers/components/customer-table"

export const metadata: Metadata = {
  title: "Customers",
  description: "Everyone who has paid for an order, with what they bought and how to reach them.",
}

export default function AdminCustomersPage() {
  return <CustomerTable />
}
