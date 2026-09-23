import type { Metadata } from "next"

import { CheckoutView } from "@/features/checkout/components/checkout-view"

export const metadata: Metadata = {
  title: "Checkout",
  description: "Secure checkout: UPI, cards and netbanking.",
  robots: { index: false, follow: false },
}

export default function CheckoutPage() {
  return <CheckoutView />
}
