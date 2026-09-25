import type { Metadata } from "next"

import { getLivePrices } from "@/features/catalog/server/catalog.service"
import { CartView } from "@/features/cart/components/cart-view"

export const metadata: Metadata = {
  title: "Your cart",
  description: "Review your SKELMET order before checkout.",
  robots: { index: false, follow: true },
}

/** Live prices, so the cart can correct lines saved at an older price. */
export const revalidate = 60

export default async function CartPage() {
  return <CartView prices={await getLivePrices()} />
}
