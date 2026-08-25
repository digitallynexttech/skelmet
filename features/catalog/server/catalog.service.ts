import "server-only"

import { FLAME_SKULL_MOUNT, PRODUCTS, type Product } from "@/features/catalog/catalog"
import { hasDatabase } from "@/lib/env"
import { ok, runAction, type ActionResult } from "@/server/action-result"

/**
 * Reads the catalogue.
 *
 * Today it serves the client-safe registry, because SKELMET is a single SKU and
 * a database round-trip would buy nothing. The signature is the DB-backed one,
 * so moving to Postgres is a change inside this file and nowhere else, the
 * route, the hook and the components already speak ActionResult.
 */
export async function listProducts(): Promise<ActionResult<Product[]>> {
  return runAction(async () => {
    if (!hasDatabase()) return ok(PRODUCTS)

    // When the catalogue moves to Postgres:
    //   const rows = await db.product.findMany({
    //     where: { status: "ACTIVE" },
    //     select: PRODUCT_SELECT,   // select, never include (§7)
    //     take: 50,
    //   })
    //   return ok(rows.map(serialize))
    return ok(PRODUCTS)
  })
}

export async function getProductBySlug(slug: string): Promise<ActionResult<Product | null>> {
  return runAction(async () => {
    const found = PRODUCTS.find((p) => p.slug === slug) ?? null
    return ok(found)
  })
}

export async function getFeaturedProduct(): Promise<ActionResult<Product>> {
  return runAction(async () => ok(FLAME_SKULL_MOUNT))
}
