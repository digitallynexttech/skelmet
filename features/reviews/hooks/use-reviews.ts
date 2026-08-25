"use client"

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { apiFetch } from "@/lib/api-fetch"
import { mutationWithToast } from "@/lib/query"

export type ReviewStatus = "PENDING" | "PUBLISHED" | "REJECTED"

export type ReviewRow = {
  id: string
  authorName: string
  city: string | null
  rating: number
  title: string
  body: string
  status: ReviewStatus
  createdAt: string
  product: { name: string; slug: string }
  verified: boolean
}

type ReviewPage = {
  data: ReviewRow[]
  pagination: { page: number; pageSize: number; total: number; totalPages: number }
  pendingCount: number
}

export function useReviews(params: { page: number; status: string }) {
  return useQuery({
    queryKey: ["reviews", params],
    queryFn: () => {
      const search = new URLSearchParams({ page: String(params.page) })
      if (params.status && params.status !== "ALL") search.set("status", params.status)
      return apiFetch<ReviewPage>(`/api/admin/reviews?${search}`)
    },
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })
}

/** Invalidates: ["reviews"] */
export function useReviewActions() {
  const qc = useQueryClient()
  const invalidate = () => void qc.invalidateQueries({ queryKey: ["reviews"] })

  const publish = useMutation({
    mutationFn: mutationWithToast(
      (id: string) => apiFetch<ReviewRow>(`/api/admin/reviews/${id}/publish`, { method: "POST" }),
      { loading: "Publishing…", success: "Review is live" },
    ),
    onSuccess: invalidate,
  })

  const reject = useMutation({
    mutationFn: mutationWithToast(
      (id: string) => apiFetch<ReviewRow>(`/api/admin/reviews/${id}/reject`, { method: "POST" }),
      { loading: "Rejecting…", success: "Review rejected" },
    ),
    onSuccess: invalidate,
  })

  return { publish, reject }
}
