import type { Metadata } from "next"

import { CheckoutView } from "@/features/checkout/components/checkout-view"

export const metadata: Metadata = {
  title: "Checkout",
  description: "Secure checkout: UPI, cards, netbanking and cash on delivery.",
  robots: { index: false, follow: false },
}

export default function CheckoutPage() {
  return <CheckoutView />
}
