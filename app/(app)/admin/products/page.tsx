import type { Metadata } from "next"

import { ProductManager } from "@/features/products/components/product-manager"

export const metadata: Metadata = {
  title: "Products",
  description: "Prices, stock and what is live on the storefront, colourway by colourway.",
}

export default function AdminProductsPage() {
  return <ProductManager />
}
