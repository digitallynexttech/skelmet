"use client"

import * as React from "react"
import { Check, Star, X } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { Stars } from "@/components/shared/stars"
import { Badge } from "@/components/ui/badge"
import { ViewMenu } from "@/components/ui/view-menu"
import { HeaderButton } from "@/components/ui/header-button"
import {
  useReviewActions,
  useReviews,
  type ReviewStatus,
} from "@/features/reviews/hooks/use-reviews"

type Filter = ReviewStatus | "ALL"

// All first, as every view menu has it; the queue still opens on Waiting.
const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "PENDING", label: "Waiting" },
  { value: "PUBLISHED", label: "Published" },
  { value: "REJECTED", label: "Rejected" },
]

const TONE: Record<ReviewStatus, "ember" | "acid" | "outline"> = {
  PENDING: "ember",
  PUBLISHED: "acid",
  REJECTED: "outline",
}

export function ReviewQueue() {
  const [page, setPage] = React.useState(1)
  const [status, setStatus] = React.useState<Filter>("PENDING")

  const { data, isLoading, isError, error } = useReviews({ page, status })
  const { publish, reject } = useReviewActions()
  const busy = publish.isPending || reject.isPending

  const rows = data?.data ?? []
  const pages = data?.pagination.totalPages ?? 1

  return (
    <div className="flex flex-col gap-5">
      <PageHeader icon={Star} title="Reviews" />

      {/* Not a table, so no table bar: the view menu sits over the cards. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <ViewMenu
          value={status}
          onChange={(next) => {
            setStatus(next)
            setPage(1)
          }}
          // Waiting counts every review waiting, whichever view is open.
          options={FILTERS.map((f) => ({
            ...f,
            count: f.value === "PENDING" ? data?.pendingCount : undefined,
          }))}
        />
        <p className="text-dim text-[12.5px]">
          Nothing shows on the product page until it is published here.
        </p>
      </div>

      {isLoading ? (
        <div className="rounded-card h-80 animate-pulse bg-white/5" />
      ) : isError ? (
        <EmptyState
          title="Could not load reviews"
          description={error instanceof Error ? error.message : "Try again in a moment."}
        />
      ) : rows.length === 0 ? (
        <EmptyState title="Queue is clear" description="No reviews are waiting on you right now." />
      ) : (
        <div className="flex flex-col gap-4">
          {rows.map((r) => (
            <article key={r.id} className="rounded-card bg-carbon border border-white/[0.09] p-6">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="mb-2 flex items-center gap-3">
                    <Stars rating={r.rating} />
                    <Badge variant={TONE[r.status]}>{r.status}</Badge>
                    {r.verified ? <Badge variant="violet">Verified buyer</Badge> : null}
                  </div>
                  <h2 className="text-bone text-[15px] font-semibold">{r.title}</h2>
                  <p className="text-dim mt-1 font-mono text-[11.5px]">
                    {r.authorName}
                    {r.city ? `, ${r.city}` : ""} on {r.product.name} ·{" "}
                    {new Date(r.createdAt).toLocaleDateString("en-IN")}
                  </p>
                </div>

                {r.status === "PENDING" ? (
                  <div className="flex gap-2">
                    <HeaderButton
                      variant="primary"
                      className="px-3"
                      disabled={busy}
                      onClick={() => publish.mutate(r.id)}
                    >
                      <Check className="size-3.5" strokeWidth={2.4} />
                      Publish
                    </HeaderButton>
                    <HeaderButton
                      className="px-3"
                      disabled={busy}
                      onClick={() => reject.mutate(r.id)}
                    >
                      <X className="size-3.5" strokeWidth={2.4} />
                      Reject
                    </HeaderButton>
                  </div>
                ) : r.status === "REJECTED" ? (
                  <HeaderButton disabled={busy} onClick={() => publish.mutate(r.id)}>
                    Publish anyway
                  </HeaderButton>
                ) : (
                  <HeaderButton disabled={busy} onClick={() => reject.mutate(r.id)}>
                    Take down
                  </HeaderButton>
                )}
              </div>

              <p className="text-ash text-[14.5px] leading-[1.7]">{r.body}</p>
            </article>
          ))}
        </div>
      )}

      {pages > 1 ? (
        <div className="flex items-center justify-between">
          <HeaderButton disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </HeaderButton>
          <span className="text-dim font-mono text-[12px]">
            Page {page} of {pages}
          </span>
          <HeaderButton disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            Next
          </HeaderButton>
        </div>
      ) : null}
    </div>
  )
}
