import "server-only"

import { FLAME_SKULL_MOUNT, PRODUCTS, type Product } from "@/features/catalog/catalog"
import { hasDatabase } from "@/lib/env"
import { ok, runAction, type ActionResult } from "@/server/action-result"
import { db } from "@/server/db"

// Editorial content comes from the registry; price and stock from the database, since checkout
// charges the database price. Without a database the registry is used whole.

// Live figures by SKU. `forSale`: checkout refuses a product that is not ACTIVE.
async function liveBySku(skus: string[]) {
  const rows = await db.variant.findMany({
    where: { sku: { in: skus } },
    // select, never include (§7).
    select: { sku: true, price: true, stock: true, product: { select: { status: true } } },
  })
  return new Map(
    rows.map((r) => [
      r.sku,
      { price: r.price.toString(), stock: r.stock, forSale: r.product.status === "ACTIVE" },
    ]),
  )
}

// Overlays live price and stock. A SKU missing from the database keeps its registry values.
async function withLive(product: Product): Promise<Product> {
  const live = await liveBySku(product.colourways.map((c) => c.sku))

  const colourways = product.colourways.map((c) => {
    const row = live.get(c.sku)
    if (!row) return c
    // Not ACTIVE reads as sold out: the page stays up and offers nothing checkout refuses.
    const stock = row.forSale ? row.stock : 0
    return { ...c, price: row.price, stock, inStock: stock > 0 }
  })

  // The product-level price (cards, hero, sticky bar) tracks the default colourway.
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

/**
 * Not in runAction on purpose: a failed live read must throw, so ISR keeps the last good page
 * instead of caching a not-found one. `null` means no such slug.
 */
export async function getProductBySlug(slug: string): Promise<ActionResult<Product | null>> {
  const found = PRODUCTS.find((p) => p.slug === slug) ?? null
  if (!found) return ok(null)
  if (!hasDatabase()) return ok(found)
  return ok(await withLive(found))
}

/**
 * Live price per SKU, for the cart and checkout to correct a saved line's price. Registry prices
 * stand in without a database or for a SKU it lacks.
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

/** The same, as a service answer: what the cart drawer asks for when it opens. */
export async function livePrices(): Promise<ActionResult<Record<string, string>>> {
  return runAction(async () => ok(await getLivePrices()))
}

export async function getFeaturedProduct(): Promise<ActionResult<Product>> {
  return runAction(async () => {
    if (!hasDatabase()) return ok(FLAME_SKULL_MOUNT)
    return ok(await withLive(FLAME_SKULL_MOUNT))
  })
}
