import "server-only"

import {
  adjustStockSchema,
  updateProductSchema,
  updateVariantSchema,
} from "@/features/products/schemas/product.schema"
import { refreshStorefront } from "@/features/catalog/server/refresh-storefront"
import { PERMISSIONS } from "@/lib/constants"
import { hasDatabase } from "@/lib/env"
import { createAuditLog, getAuditMeta } from "@/server/audit"
import { fail, ok, runAction, type ActionResult } from "@/server/action-result"
import { requirePermission } from "@/server/action-guard"
import { db } from "@/server/db"

export type VariantRow = {
  id: string
  colourway: string
  sku: string
  price: string
  stock: number
  weightGrams: number | null
}

export type ProductRow = {
  id: string
  slug: string
  name: string
  strapline: string | null
  basePrice: string
  status: "DRAFT" | "ACTIVE" | "ARCHIVED"
  variants: VariantRow[]
  totalStock: number
  createdAt: string
}

const PRODUCT_SELECT = {
  id: true,
  slug: true,
  name: true,
  strapline: true,
  basePrice: true,
  status: true,
  createdAt: true,
  variants: {
    select: {
      id: true,
      colourway: true,
      sku: true,
      price: true,
      stock: true,
      weightGrams: true,
    },
    orderBy: { colourway: "asc" },
  },
} as const

type RawProduct = {
  id: string
  slug: string
  name: string
  strapline: string | null
  basePrice: { toString(): string }
  status: string
  createdAt: Date
  variants: Array<{
    id: string
    colourway: string
    sku: string
    price: { toString(): string }
    stock: number
    weightGrams: number | null
  }>
}

function serialize(row: RawProduct): ProductRow {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    strapline: row.strapline,
    basePrice: row.basePrice.toString(),
    status: row.status as ProductRow["status"],
    createdAt: row.createdAt.toISOString(),
    variants: row.variants.map((v) => ({
      id: v.id,
      colourway: v.colourway,
      sku: v.sku,
      price: v.price.toString(),
      stock: v.stock,
      weightGrams: v.weightGrams,
    })),
    totalStock: row.variants.reduce((sum, v) => sum + v.stock, 0),
  }
}

export async function listProducts(): Promise<ActionResult<{ data: ProductRow[] }>> {
  return runAction(async () => {
    await requirePermission(PERMISSIONS.PRODUCT_READ)
    if (!hasDatabase()) return fail("Database not configured.", undefined, 503)

    const rows = await db.product.findMany({
      select: PRODUCT_SELECT,
      orderBy: { createdAt: "desc" },
    })

    return ok({ data: rows.map(serialize) })
  })
}

export async function updateProduct(id: string, raw: unknown): Promise<ActionResult<ProductRow>> {
  return runAction(async () => {
    const session = await requirePermission(PERMISSIONS.PRODUCT_WRITE)
    if (!hasDatabase()) return fail("Database not configured.", undefined, 503)

    const input = updateProductSchema.parse(raw)
    const exists = await db.product.findUnique({ where: { id }, select: { id: true } })
    if (!exists) return fail("Product not found.", undefined, 404)

    const row = await db.product.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.strapline !== undefined ? { strapline: input.strapline } : {}),
        ...(input.basePrice !== undefined ? { basePrice: input.basePrice } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      },
      select: PRODUCT_SELECT,
    })

    await createAuditLog(session, {
      action: "product:update",
      module: "product",
      entityId: id,
      meta: input as Record<string, unknown>,
      ...(await getAuditMeta()),
    })
    refreshStorefront()

    return ok(serialize(row))
  })
}

export async function updateVariant(id: string, raw: unknown): Promise<ActionResult<VariantRow>> {
  return runAction(async () => {
    const session = await requirePermission(PERMISSIONS.PRODUCT_WRITE)
    if (!hasDatabase()) return fail("Database not configured.", undefined, 503)

    const input = updateVariantSchema.parse(raw)
    const before = await db.variant.findUnique({
      where: { id },
      select: { id: true, sku: true, price: true, stock: true },
    })
    if (!before) return fail("Variant not found.", undefined, 404)

    const row = await db.variant.update({
      where: { id },
      data: {
        ...(input.price !== undefined ? { price: input.price } : {}),
        ...(input.stock !== undefined ? { stock: input.stock } : {}),
        ...(input.weightGrams !== undefined ? { weightGrams: input.weightGrams } : {}),
      },
      select: {
        id: true,
        colourway: true,
        sku: true,
        price: true,
        stock: true,
        weightGrams: true,
      },
    })

    await createAuditLog(session, {
      action: "variant:update",
      module: "product",
      entityId: id,
      meta: {
        sku: before.sku,
        before: { price: before.price.toString(), stock: before.stock },
        after: { price: row.price.toString(), stock: row.stock },
      },
      ...(await getAuditMeta()),
    })
    refreshStorefront()

    return ok({
      id: row.id,
      colourway: row.colourway,
      sku: row.sku,
      price: row.price.toString(),
      stock: row.stock,
      weightGrams: row.weightGrams,
    })
  })
}

/**
 * Stock in and out by a delta rather than an absolute, so two people counting
 * the same shelf at the same time add up instead of overwriting each other.
 * The guard in `where` is what stops a race pushing stock negative.
 */
export async function adjustStock(id: string, raw: unknown): Promise<ActionResult<VariantRow>> {
  return runAction(async () => {
    const session = await requirePermission(PERMISSIONS.PRODUCT_WRITE)
    if (!hasDatabase()) return fail("Database not configured.", undefined, 503)

    const input = adjustStockSchema.parse(raw)

    const claimed = await db.variant.updateMany({
      where: input.delta < 0 ? { id, stock: { gte: -input.delta } } : { id },
      data: { stock: { increment: input.delta } },
    })

    if (claimed.count === 0) {
      const exists = await db.variant.findUnique({ where: { id }, select: { stock: true } })
      if (!exists) return fail("Variant not found.", undefined, 404)
      return fail(`Only ${exists.stock} in stock, cannot remove ${-input.delta}.`, undefined, 409)
    }

    const row = await db.variant.findUniqueOrThrow({
      where: { id },
      select: {
        id: true,
        colourway: true,
        sku: true,
        price: true,
        stock: true,
        weightGrams: true,
      },
    })

    await createAuditLog(session, {
      action: "variant:stock",
      module: "product",
      entityId: id,
      meta: { sku: row.sku, delta: input.delta, to: row.stock, reason: input.reason ?? null },
      ...(await getAuditMeta()),
    })
    refreshStorefront()

    return ok({
      id: row.id,
      colourway: row.colourway,
      sku: row.sku,
      price: row.price.toString(),
      stock: row.stock,
      weightGrams: row.weightGrams,
    })
  })
}
