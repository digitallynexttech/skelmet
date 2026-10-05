import type { Metadata } from "next"
import { Suspense } from "react"

import { PageSkeleton } from "@/components/shared/page-skeleton"

import { OrderTable } from "@/features/orders/components/order-table"
import { hasFullAccess, staffSession } from "@/server/action-guard"

export const metadata: Metadata = {
  title: "Orders",
  description: "Orders to fulfil, paid or cash on delivery, and every stage after, newest first.",
}

export default async function AdminOrdersPage() {
  // Only owners and admins are offered Delete test orders; the server checks again.
  const canDeleteTest = hasFullAccess(await staffSession())
  return (
    // useSearchParams needs a Suspense boundary in the app router.
    <Suspense fallback={<PageSkeleton />}>
      <OrderTable scope="paid" canDeleteTest={canDeleteTest} />
    </Suspense>
  )
}
