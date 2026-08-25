"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { apiFetch } from "@/lib/api-fetch"
import { mutationWithToast } from "@/lib/query"

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

export function useProducts() {
  return useQuery({
    queryKey: ["products"],
    queryFn: () => apiFetch<{ data: ProductRow[] }>("/api/admin/products"),
    staleTime: 30_000,
  })
}

/** Invalidates: ["products"] */
export function useProductMutations() {
  const qc = useQueryClient()
  const invalidate = () => void qc.invalidateQueries({ queryKey: ["products"] })

  const updateProduct = useMutation({
    mutationFn: mutationWithToast(
      ({ id, ...body }: { id: string } & Record<string, unknown>) =>
        apiFetch<ProductRow>(`/api/admin/products/${id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        }),
      { loading: "Saving product…", success: "Product saved" },
    ),
    onSuccess: invalidate,
  })

  const updateVariant = useMutation({
    mutationFn: mutationWithToast(
      ({ id, ...body }: { id: string } & Record<string, unknown>) =>
        apiFetch<VariantRow>(`/api/admin/variants/${id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        }),
      { loading: "Saving…", success: "Variant saved" },
    ),
    onSuccess: invalidate,
  })

  const adjustStock = useMutation({
    mutationFn: mutationWithToast(
      ({ id, delta }: { id: string; delta: number }) =>
        apiFetch<VariantRow>(`/api/admin/variants/${id}/stock`, {
          method: "POST",
          body: JSON.stringify({ delta }),
        }),
      { loading: "Updating stock…", success: "Stock updated" },
    ),
    onSuccess: invalidate,
  })

  return { updateProduct, updateVariant, adjustStock }
}
