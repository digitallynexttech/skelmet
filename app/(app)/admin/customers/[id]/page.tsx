"use client"

import { use } from "react"

import { CustomerDetailView } from "@/features/customers/components/customer-detail"

export default function AdminCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return <CustomerDetailView id={id} />
}
