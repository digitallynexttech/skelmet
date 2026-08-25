"use client"

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { apiFetch } from "@/lib/api-fetch"
import { mutationWithToast } from "@/lib/query"

export type CouponRow = {
  id: string
  code: string
  kind: "PERCENT" | "FLAT"
  value: string
  minSubtotal: string
  maxUses: number | null
  usedCount: number
  expiresAt: string | null
  createdAt: string
  state: "ACTIVE" | "EXPIRED" | "EXHAUSTED"
}

type Paginated<T> = {
  data: T[]
  pagination: { page: number; pageSize: number; total: number; totalPages: number }
}

const getCoupons = (params: { page: number; q: string }) => {
  const search = new URLSearchParams({ page: String(params.page) })
  if (params.q) search.set("q", params.q)
  return apiFetch<Paginated<CouponRow>>(`/api/admin/coupons?${search}`)
}

export function useCoupons(params: { page: number; q: string }) {
  return useQuery({
    queryKey: ["coupons", params],
    queryFn: () => getCoupons(params),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })
}

/** Invalidates: ["coupons"] */
export function useCouponMutations() {
  const qc = useQueryClient()
  const invalidate = () => void qc.invalidateQueries({ queryKey: ["coupons"] })

  const create = useMutation({
    mutationFn: mutationWithToast(
      (input: Record<string, unknown>) =>
        apiFetch<CouponRow>("/api/admin/coupons", {
          method: "POST",
          body: JSON.stringify(input),
        }),
      { loading: "Creating code…", success: "Discount code created" },
    ),
    onSuccess: invalidate,
  })

  const expire = useMutation({
    mutationFn: mutationWithToast(
      (id: string) => apiFetch<CouponRow>(`/api/admin/coupons/${id}`, { method: "DELETE" }),
      { loading: "Expiring code…", success: "Code expired" },
    ),
    onSuccess: invalidate,
  })

  return { create, expire }
}
