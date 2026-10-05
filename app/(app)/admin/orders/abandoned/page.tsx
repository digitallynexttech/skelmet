import type { Metadata } from "next"
import { Suspense } from "react"

import { PageSkeleton } from "@/components/shared/page-skeleton"

import { AbandonedCarts } from "@/features/orders/components/abandoned-carts"

export const metadata: Metadata = {
  title: "Abandoned carts",
  description: "Shoppers who reached payment or the cart and stopped, and what they left behind.",
}

export default function AdminAbandonedCartsPage() {
  return (
    // useSearchParams needs a Suspense boundary in the app router.
    <Suspense fallback={<PageSkeleton />}>
      <AbandonedCarts />
    </Suspense>
  )
}
