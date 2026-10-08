"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { apiFetch } from "@/lib/api-fetch"
import { mutationWithToast } from "@/lib/query"

/** SCHEDULED: published with a future date, off the site until then. DRAFT includes taken down. */
export type PostStatus = "DRAFT" | "SCHEDULED" | "LIVE"

export type ManagedPost = {
  /** The Sanity id, without the "drafts." prefix. */
  id: string
  title: string
  slug: string | null
  category: string | null
  author: string | null
  status: PostStatus
  /** A draft may carry one from an earlier publish. */
  publishedAt: string | null
  /** A published post with unpublished edits. */
  hasChanges: boolean
  /** What a draft lacks before it can be published. */
  missing: string[]
  updatedAt: string
}

export type ManagedPosts = {
  data: ManagedPost[]
  counts: Record<PostStatus, number>
  canPublish: boolean
}

const act = (id: string, verb: string, body?: unknown) =>
  apiFetch<{ id: string; status: PostStatus }>(`/api/admin/blog/${id}/${verb}`, {
    method: "POST",
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })

export function useManagedPosts() {
  return useQuery({
    queryKey: ["blog", "posts"],
    queryFn: () => apiFetch<ManagedPosts>("/api/admin/blog"),
    // Posts are edited in the Studio, in another tab: read them again on return.
    staleTime: 0,
    refetchOnWindowFocus: true,
  })
}

/** Invalidates: ["blog"] */
export function usePostActions() {
  const qc = useQueryClient()
  const onSuccess = () => void qc.invalidateQueries({ queryKey: ["blog"] })

  const publish = useMutation({
    mutationFn: mutationWithToast((id: string) => act(id, "publish"), {
      loading: "Publishing…",
      success: "Published: it is on the site",
    }),
    onSuccess,
  })

  const schedule = useMutation({
    mutationFn: mutationWithToast(
      ({ id, at }: { id: string; at: string }) => act(id, "schedule", { at }),
      { loading: "Scheduling…", success: "Scheduled" },
    ),
    onSuccess,
  })

  const unpublish = useMutation({
    mutationFn: mutationWithToast((id: string) => act(id, "unpublish"), {
      loading: "Taking it down…",
      success: "Taken off the site, and kept as a draft",
    }),
    onSuccess,
  })

  return { publish, schedule, unpublish }
}
