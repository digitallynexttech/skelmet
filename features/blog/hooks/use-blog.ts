"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { apiFetch } from "@/lib/api-fetch"
import { mutationWithToast } from "@/lib/query"

// ── wire types ────────────────────────────────────────────

/**
 * Where a post stands, as the site sees it:
 *   DRAFT      written, and never published - or taken back down
 *   SCHEDULED  published with a date still to come; off the site until then
 *   LIVE       on the site
 */
export type PostStatus = "DRAFT" | "SCHEDULED" | "LIVE"

export type ManagedPost = {
  /** The post's id in Sanity, without the "drafts." a draft carries. */
  id: string
  title: string
  slug: string | null
  category: string | null
  author: string | null
  status: PostStatus
  /** When it goes live, or went live. A draft may carry one from an earlier publish. */
  publishedAt: string | null
  /** A published post with edits that have not been published yet. */
  hasChanges: boolean
  /** What a draft still lacks before it can be published; empty when it is ready. */
  missing: string[]
  updatedAt: string
}

export type ManagedPosts = {
  data: ManagedPost[]
  counts: Record<PostStatus, number>
  /** Whether this member of staff may publish, schedule and take down. */
  canPublish: boolean
}

// ── fetchers ──────────────────────────────────────────────

const act = (id: string, verb: string, body?: unknown) =>
  apiFetch<{ id: string; status: PostStatus }>(`/api/admin/blog/${id}/${verb}`, {
    method: "POST",
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })

// ── queries ───────────────────────────────────────────────

export function useManagedPosts() {
  return useQuery({
    queryKey: ["blog", "posts"],
    queryFn: () => apiFetch<ManagedPosts>("/api/admin/blog"),
    // Posts are edited in the Studio, in another tab: read them again on return.
    staleTime: 0,
    refetchOnWindowFocus: true,
  })
}

// ── mutations ─────────────────────────────────────────────

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
