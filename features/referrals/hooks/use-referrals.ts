"use client"

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { apiFetch } from "@/lib/api-fetch"
import { mutationWithToast } from "@/lib/query"

export type ReferralStatus = "SENT" | "OPENED" | "ORDERED" | "SHIPPING" | "PAID" | "VOID"

export type ReferralRow = {
  id: string
  refereeEmail: string
  status: ReferralStatus
  rewardAmount: string
  creditedAt: string | null
  createdAt: string
  referrer: { id: string; name: string | null; email: string; balance: string }
  orderCount: number
}

type Paginated<T> = {
  data: T[]
  pagination: { page: number; pageSize: number; total: number; totalPages: number }
}

export function useReferrals(params: { page: number; status: string; q: string }) {
  return useQuery({
    queryKey: ["referrals", params],
    queryFn: () => {
      const search = new URLSearchParams({ page: String(params.page) })
      if (params.status && params.status !== "ALL") search.set("status", params.status)
      if (params.q) search.set("q", params.q)
      return apiFetch<Paginated<ReferralRow>>(`/api/admin/referrals?${search}`)
    },
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })
}

/** Invalidates: ["referrals"] */
export function useReferralActions() {
  const qc = useQueryClient()
  const invalidate = () => void qc.invalidateQueries({ queryKey: ["referrals"] })

  const approve = useMutation({
    mutationFn: mutationWithToast(
      (id: string) =>
        apiFetch<ReferralRow>(`/api/admin/referrals/${id}/approve`, { method: "POST" }),
      { loading: "Crediting referrer…", success: "Reward credited" },
    ),
    onSuccess: invalidate,
  })

  const voidReferral = useMutation({
    mutationFn: mutationWithToast(
      (id: string) => apiFetch<ReferralRow>(`/api/admin/referrals/${id}/void`, { method: "POST" }),
      { loading: "Voiding…", success: "Referral voided" },
    ),
    onSuccess: invalidate,
  })

  return { approve, voidReferral }
}
