"use client"

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { apiFetch } from "@/lib/api-fetch"
import { MAX_PAGE_SIZE } from "@/lib/constants"
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
  archivedAt: string | null
  showInCart: boolean
  createdAt: string
  state: "ACTIVE" | "EXPIRED" | "EXHAUSTED"
}

type Paginated<T> = {
  data: T[]
  pagination: { page: number; pageSize: number; total: number; totalPages: number }
}

/** Codes, or the archive. */
export type CouponView = "codes" | "archived"

const getCoupons = (params: { page: number; q: string; view: CouponView }) => {
  const search = new URLSearchParams({
    page: String(params.page),
    // Sorting and export run over what is loaded, so take the window.
    pageSize: String(MAX_PAGE_SIZE),
  })
  if (params.q) search.set("q", params.q)
  if (params.view === "archived") search.set("view", "archived")
  return apiFetch<Paginated<CouponRow>>(`/api/admin/coupons?${search}`)
}

export function useCoupons(params: { page: number; q: string; view: CouponView }) {
  return useQuery({
    queryKey: ["coupons", params],
    queryFn: () => getCoupons(params),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })
}

export type CouponTerms = {
  kind: "PERCENT" | "FLAT"
  value: string
  minSubtotal: string | null
  maxUses: number | null
}

export type CouponRun = {
  index: number
  startedBy: "created" | "renewed"
  start: string
  end: string | null
  expiresAt: string | null
  terms: CouponTerms | null
  orders: number
  discount: number
  sales: number
  refunded: number
}

export type CouponHistoryOrder = {
  id: string
  number: string
  status: string
  customer: string
  email: string
  at: string
  subtotal: string
  discount: string
  total: string
  run: number
}

export type CouponEvent = {
  action: string
  at: string
  by: string | null
  meta: Record<string, unknown> | null
}

export type CouponHistory = {
  coupon: CouponRow
  runs: CouponRun[]
  orders: CouponHistoryOrder[]
  canSeeOrders: boolean
  events: CouponEvent[]
}

/** One code, with its runs, orders and log. Shares ["coupons"], so any change refreshes it. */
export function useCouponHistory(id: string) {
  return useQuery({
    queryKey: ["coupons", "history", id],
    queryFn: () => apiFetch<CouponHistory>(`/api/admin/coupons/${id}`),
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

  const archive = useMutation({
    mutationFn: mutationWithToast(
      (id: string) => apiFetch<CouponRow>(`/api/admin/coupons/${id}/archive`, { method: "POST" }),
      { loading: "Archiving code…", success: "Code archived" },
    ),
    onSuccess: invalidate,
  })

  const restore = useMutation({
    mutationFn: mutationWithToast(
      (id: string) => apiFetch<CouponRow>(`/api/admin/coupons/${id}/archive`, { method: "DELETE" }),
      { loading: "Restoring code…", success: "Code restored" },
    ),
    onSuccess: invalidate,
  })

  const showInCart = useMutation({
    mutationFn: mutationWithToast(
      ({ id, show }: { id: string; show: boolean }) =>
        apiFetch<CouponRow>(`/api/admin/coupons/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ showInCart: show }),
        }),
      { loading: "Saving…", success: "Saved" },
    ),
    onSuccess: invalidate,
  })

  const renew = useMutation({
    mutationFn: mutationWithToast(
      ({ id, input }: { id: string; input: Record<string, unknown> }) =>
        apiFetch<CouponRow>(`/api/admin/coupons/${id}/renew`, {
          method: "POST",
          body: JSON.stringify(input),
        }),
      { loading: "Renewing code…", success: "Code renewed" },
    ),
    onSuccess: invalidate,
  })

  return { create, expire, archive, restore, showInCart, renew }
}
