"use client"

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { apiFetch } from "@/lib/api-fetch"
import { MAX_PAGE_SIZE } from "@/lib/constants"
import { mutationWithToast } from "@/lib/query"

export type InquiryStatus = "NEW" | "OPEN" | "RESOLVED"

export type InquiryRow = {
  id: string
  name: string
  email: string
  phone: string | null
  topic: string
  orderNumber: string | null
  message: string
  status: InquiryStatus
  createdAt: string
}

type InquiryPage = {
  data: InquiryRow[]
  pagination: { page: number; pageSize: number; total: number; totalPages: number }
  newCount: number
}

export function useInquiries(params: { page: number; status: string; q: string }) {
  return useQuery({
    queryKey: ["inquiries", params],
    queryFn: () => {
      const search = new URLSearchParams({
        page: String(params.page),
        // Sorting and export run over what is loaded, so take the window.
        pageSize: String(MAX_PAGE_SIZE),
      })
      if (params.status && params.status !== "ALL") search.set("status", params.status)
      if (params.q) search.set("q", params.q)
      return apiFetch<InquiryPage>(`/api/admin/inquiries?${search}`)
    },
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })
}

/** Invalidates: ["inquiries"] */
export function useInquiryActions() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: mutationWithToast(
      ({ id, status }: { id: string; status: InquiryStatus }) =>
        apiFetch<InquiryRow>(`/api/admin/inquiries/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ status }),
        }),
      { loading: "Updating…", success: "Inquiry updated" },
    ),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["inquiries"] }),
  })
}
