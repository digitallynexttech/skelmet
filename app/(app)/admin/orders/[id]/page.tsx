"use client"

import { use } from "react"

import { OrderDetailView } from "@/features/orders/components/order-detail"

export default function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return <OrderDetailView id={id} />
}
