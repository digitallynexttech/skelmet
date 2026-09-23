"use client"

import { Suspense } from "react"

import { OrderTable } from "@/features/orders/components/order-table"

export default function AdminOrdersPage() {
  // useSearchParams needs a Suspense boundary in the app router.
  return (
    <Suspense fallback={<div className="rounded-md h-96 animate-pulse bg-white/5" />}>
      <OrderTable />
    </Suspense>
  )
}
