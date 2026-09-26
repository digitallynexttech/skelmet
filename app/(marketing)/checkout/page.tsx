import type { Metadata } from "next"
import { Suspense } from "react"

import { getLivePrices } from "@/features/catalog/server/catalog.service"
import { CheckoutView } from "@/features/checkout/components/checkout-view"

export const metadata: Metadata = {
  title: "Checkout",
  description: "Secure checkout: UPI, cards and netbanking.",
  robots: { index: false, follow: false },
}

/** Live prices, so the cart can correct lines saved at an older price. */
export const revalidate = 60

export default async function CheckoutPage() {
  const prices = await getLivePrices()
  return (
    // CheckoutView reads the Buy now line from the search params, which a
    // prerendered page can only do inside a Suspense boundary.
    <Suspense fallback={<div className="min-h-[60vh]" aria-hidden />}>
      <CheckoutView prices={prices} />
    </Suspense>
  )
}
