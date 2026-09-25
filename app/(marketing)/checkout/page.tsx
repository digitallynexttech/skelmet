import type { Metadata } from "next"

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
  return <CheckoutView prices={await getLivePrices()} />
}
