"use client"

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { apiFetch } from "@/lib/api-fetch"
import { MAX_PAGE_SIZE } from "@/lib/constants"
import { mutationWithToast } from "@/lib/query"
import type { SendCampaignInput } from "@/features/newsletter/schemas/newsletter.schema"

export type SubscriberStatus = "SUBSCRIBED" | "UNSUBSCRIBED"

export type SubscriberRow = {
  id: string
  email: string
  status: SubscriberStatus
  source: string
  subscribedAt: string
  unsubscribedAt: string | null
}

type SubscriberPage = {
  data: SubscriberRow[]
  pagination: { page: number; pageSize: number; total: number; totalPages: number }
  counts: { subscribed: number; unsubscribed: number }
}

export type CampaignRow = {
  id: string
  subject: string
  body: string
  ctaLabel: string | null
  ctaUrl: string | null
  status: "SENDING" | "PAUSED" | "SENT"
  running: boolean
  recipients: number
  sent: number
  failed: number
  note: string | null
  sentByEmail: string | null
  createdAt: string
  finishedAt: string | null
}

export function useSubscribers(params: { status: string; q: string }) {
  return useQuery({
    queryKey: ["newsletter", "subscribers", params],
    queryFn: () => {
      const search = new URLSearchParams({
        page: "1",
        // Sorting and export run over what is loaded, so take the window.
        pageSize: String(MAX_PAGE_SIZE),
      })
      if (params.status && params.status !== "ALL") search.set("status", params.status)
      if (params.q) search.set("q", params.q)
      return apiFetch<SubscriberPage>(`/api/admin/newsletter/subscribers?${search}`)
    },
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })
}

/** Invalidates: ["newsletter"] */
export function useSubscriberActions() {
  const qc = useQueryClient()
  const onSuccess = () => void qc.invalidateQueries({ queryKey: ["newsletter"] })

  const unsubscribe = useMutation({
    mutationFn: mutationWithToast(
      (id: string) =>
        apiFetch<SubscriberRow>(`/api/admin/newsletter/subscribers/${id}/unsubscribe`, {
          method: "POST",
        }),
      { loading: "Unsubscribing…", success: "Unsubscribed" },
    ),
    onSuccess,
  })

  const remove = useMutation({
    mutationFn: mutationWithToast(
      (id: string) =>
        apiFetch<{ id: string }>(`/api/admin/newsletter/subscribers/${id}`, { method: "DELETE" }),
      { loading: "Deleting…", success: "Deleted" },
    ),
    onSuccess,
  })

  return { unsubscribe, remove }
}

/** Polls while one is sending, so the count climbs without a reload. */
export function useCampaigns() {
  return useQuery({
    queryKey: ["newsletter", "campaigns"],
    queryFn: () =>
      apiFetch<{ data: CampaignRow[]; subscribed: number }>("/api/admin/newsletter/campaigns"),
    refetchInterval: (query) => (query.state.data?.data.some((c) => c.running) ? 3000 : false),
  })
}

type SendResult = { test: true; to: string } | { test: false; id: string; recipients: number }

/** Invalidates: ["newsletter"]. The caller toasts: a test and a send say different things. */
export function useSendCampaign() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: SendCampaignInput) =>
      apiFetch<SendResult>("/api/admin/newsletter/campaigns", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["newsletter"] }),
  })
}

/** Invalidates: ["newsletter"] */
export function useResumeCampaign() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: mutationWithToast(
      (id: string) =>
        apiFetch<{ id: string }>(`/api/admin/newsletter/campaigns/${id}/resume`, {
          method: "POST",
        }),
      { loading: "Resuming…", success: "Sending the rest" },
    ),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["newsletter"] }),
  })
}
