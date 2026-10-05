import type { Metadata } from "next"
import { Suspense } from "react"

import { AbandonedCarts } from "@/features/orders/components/abandoned-carts"

export const metadata: Metadata = {
  title: "Abandoned carts",
  description: "Shoppers who reached payment or the cart and stopped, and what they left behind.",
}

export default function AdminAbandonedCartsPage() {
  return (
    // useSearchParams needs a Suspense boundary in the app router.
    <Suspense fallback={<div className="h-96 animate-pulse rounded-md bg-white/5" />}>
      <AbandonedCarts />
    </Suspense>
  )
}
