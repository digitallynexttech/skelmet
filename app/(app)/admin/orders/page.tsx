import type { Metadata } from "next"
import { Suspense } from "react"

import { OrderTable } from "@/features/orders/components/order-table"

export const metadata: Metadata = {
  title: "Orders",
  description: "Orders to fulfil, paid or cash on delivery, and every stage after, newest first.",
}

export default function AdminOrdersPage() {
  return (
    // useSearchParams needs a Suspense boundary in the app router.
    <Suspense fallback={<div className="h-96 animate-pulse rounded-md bg-white/5" />}>
      <OrderTable scope="paid" />
    </Suspense>
  )
}
