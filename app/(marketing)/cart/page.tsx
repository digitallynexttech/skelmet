import type { Metadata } from "next"

import { CartView } from "@/features/cart/components/cart-view"

export const metadata: Metadata = {
  title: "Your cart",
  description: "Review your SKELMET order before checkout.",
  robots: { index: false, follow: true },
}

export default function CartPage() {
  return <CartView />
}
