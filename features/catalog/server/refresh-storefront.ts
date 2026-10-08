import "server-only"

import { revalidatePath } from "next/cache"

import { PRODUCTS } from "@/features/catalog/catalog"

/**
 * Rebuilds prerendered storefront pages on their next visit after a console change.
 * Literal URLs, not "/product/[slug]": a pattern must include the route group, or it silently
 * refreshes nothing.
 */
function refresh(paths: string[]): void {
  try {
    for (const path of paths) revalidatePath(path)
  } catch (err) {
    // Outside a request (a script, a test) there is no cache to refresh.
    console.warn("[CATALOG] storefront refresh skipped", err)
  }
}

const productPages = () => PRODUCTS.map((p) => `/product/${p.slug}`)

/** After a price, product or stock edit: every page showing a price or a stock count. */
export function refreshStorefront(): void {
  refresh(["/", "/products", "/checkout", ...productPages()])
}

/** After the shipping charge changes: every page that states it. */
export function refreshShippingTerms(): void {
  refresh([...productPages(), "/policies/shipping"])
}

/** After the ways to pay change: every page with the FAQ on it, and the terms. */
export function refreshPaymentTerms(): void {
  refresh(["/", "/faq", "/contact", ...productPages(), "/policies/terms"])
}
