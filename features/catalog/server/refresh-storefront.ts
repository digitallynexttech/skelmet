import "server-only"

import { revalidatePath } from "next/cache"

import { PRODUCTS } from "@/features/catalog/catalog"

/**
 * Marks every storefront page that shows a price or a stock count for
 * rebuilding on its next visit.
 *
 * The product page is prerendered, so without this it kept the price and
 * stock it was built with until the next deploy: an admin could change the
 * price, see Razorpay charge the new one - checkout always reads the database
 * - and still find the old one on the page customers were buying from.
 * Called after every admin write that changes what those pages show; the
 * pages also refresh themselves every minute, which covers the stock that
 * orders move.
 *
 * Literal URLs rather than "/product/[slug]": a pattern is matched against
 * the route's file path, route group included - "/(marketing)/product/[slug]"
 * - so the short form silently refreshes nothing. The URL of a page always
 * matches, and PRODUCTS is the same list that decides which product pages
 * exist.
 */
export function refreshStorefront(): void {
  const paths = ["/", "/cart", "/checkout", ...PRODUCTS.map((p) => `/product/${p.slug}`)]
  try {
    for (const path of paths) revalidatePath(path)
  } catch (err) {
    // Outside a request - a script, a test - there is no cache to refresh.
    console.warn("[CATALOG] storefront refresh skipped", err)
  }
}
