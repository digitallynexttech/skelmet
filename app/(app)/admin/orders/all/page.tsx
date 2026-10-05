import type { Metadata } from "next"
import { Suspense } from "react"

import { OrderTable } from "@/features/orders/components/order-table"
import { hasFullAccess, staffSession } from "@/server/action-guard"

export const metadata: Metadata = {
  title: "All orders",
  description: "Every order, paid or not, newest first. Search by order number, email or phone.",
}

export default async function AdminAllOrdersPage() {
  // Only owners and admins are offered Delete test orders; the server checks again.
  const canDeleteTest = hasFullAccess(await staffSession())
  return (
    // useSearchParams needs a Suspense boundary in the app router.
    <Suspense fallback={<div className="h-96 animate-pulse rounded-md bg-white/5" />}>
      <OrderTable scope="all" canDeleteTest={canDeleteTest} />
    </Suspense>
  )
}
