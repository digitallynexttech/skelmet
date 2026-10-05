import type { Metadata } from "next"
import { Suspense } from "react"

import { OrderTable } from "@/features/orders/components/order-table"

export const metadata: Metadata = {
  title: "All orders",
  description: "Every order, paid or not, newest first. Search by order number, email or phone.",
}

export default function AdminAllOrdersPage() {
  return (
    // useSearchParams needs a Suspense boundary in the app router.
    <Suspense fallback={<div className="h-96 animate-pulse rounded-md bg-white/5" />}>
      <OrderTable scope="all" />
    </Suspense>
  )
}
