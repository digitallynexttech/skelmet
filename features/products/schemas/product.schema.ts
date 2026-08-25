import { z } from "zod"

export const updateProductSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  strapline: z.string().trim().max(200).nullable().optional(),
  basePrice: z.coerce.number().positive("Must be more than zero").optional(),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).optional(),
})

export const updateVariantSchema = z.object({
  price: z.coerce.number().positive("Must be more than zero").optional(),
  // Absolute stock. Use adjustStock for a delta, so two people counting the
  // same shelf cannot overwrite each other with a stale number.
  stock: z.coerce.number().int().min(0, "Cannot go below zero").optional(),
  weightGrams: z.coerce.number().int().positive().nullable().optional(),
})

export const adjustStockSchema = z.object({
  delta: z.coerce.number().int().refine((n) => n !== 0, "Enter an amount"),
  reason: z.string().trim().max(120).optional(),
})

export type UpdateProductInput = z.infer<typeof updateProductSchema>
export type UpdateVariantInput = z.infer<typeof updateVariantSchema>
export type AdjustStockInput = z.infer<typeof adjustStockSchema>
