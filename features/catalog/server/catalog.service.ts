import "server-only"

import { FLAME_SKULL_MOUNT, PRODUCTS, type Product } from "@/features/catalog/catalog"
import { hasDatabase } from "@/lib/env"
import { ok, runAction, type ActionResult } from "@/server/action-result"
import { db } from "@/server/db"

/**
 * Reads the catalogue.
 *
 * A hybrid, deliberately. The editorial half - copy, gallery, specs, swatch
 * colours - stays in the client-safe registry, because none of it is in the
 * schema and putting it there would buy nothing. The half that CHANGES on its
 * own is read from the database: price, because an admin edits it without a
 * deploy, and stock, because every order moves it.
 *
 * Before this, the product page showed the registry's price while the database
 * said something else - blaze was listed at ₹3,499 on screen and ₹3,599 in the
 * variant row, and checkout charges the database. The page was quoting a price
 * the server would not honour.
 *
 * Falls back to the registry whole when there is no database, so the marketing
 * pages still build and render with nothing behind them.
 */

/** Live figures for one product's variants, keyed by SKU. */
async function liveBySku(skus: string[]) {
  const rows = await db.variant.findMany({
    where: { sku: { in: skus } },
    // select, never include (§7).
    select: { sku: true, price: true, stock: true },
  })
  return new Map(rows.map((r) => [r.sku, { price: r.price.toString(), stock: r.stock }]))
}

/**
 * Overlays live price and stock onto a registry product.
 *
 * A SKU missing from the database keeps its registry values rather than
 * vanishing: a half-seeded database should degrade to the old behaviour, not
 * to a page with no prices on it.
 */
async function withLive(product: Product): Promise<Product> {
  const live = await liveBySku(product.colourways.map((c) => c.sku))

  const colourways = product.colourways.map((c) => {
    const row = live.get(c.sku)
    if (!row) return c
    return { ...c, price: row.price, stock: row.stock, inStock: row.stock > 0 }
  })

  // The product-level price is what surfaces outside the picker - cards, the
  // hero, the sticky bar - so it tracks the default colourway.
  const lead = colourways[0]

  return {
    ...product,
    colourways,
    price: lead?.price ?? product.price,
    unitsLeft: colourways.reduce((sum, c) => sum + c.stock, 0),
  }
}

export async function listProducts(): Promise<ActionResult<Product[]>> {
  return runAction(async () => {
    if (!hasDatabase()) return ok(PRODUCTS)
    return ok(await Promise.all(PRODUCTS.map(withLive)))
  })
}

export async function getProductBySlug(slug: string): Promise<ActionResult<Product | null>> {
  return runAction(async () => {
    const found = PRODUCTS.find((p) => p.slug === slug) ?? null
    if (!found) return ok(null)
    if (!hasDatabase()) return ok(found)
    return ok(await withLive(found))
  })
}

/**
 * Live price of every colourway, keyed by SKU, for the cart and checkout to
 * correct the price a cart line was saved with. Registry prices when there is
 * no database, or for a SKU it does not have.
 */
export async function getLivePrices(): Promise<Record<string, string>> {
  const registry = Object.fromEntries(
    PRODUCTS.flatMap((p) => p.colourways.map((c) => [c.sku, c.price] as const)),
  )
  if (!hasDatabase()) return registry
  try {
    const live = await liveBySku(Object.keys(registry))
    return { ...registry, ...Object.fromEntries([...live].map(([sku, r]) => [sku, r.price])) }
  } catch (err) {
    console.error("[CATALOG] live prices unavailable", err)
    return registry
  }
}

export async function getFeaturedProduct(): Promise<ActionResult<Product>> {
  return runAction(async () => {
    if (!hasDatabase()) return ok(FLAME_SKULL_MOUNT)
    return ok(await withLive(FLAME_SKULL_MOUNT))
  })
}
