"use client"

import * as React from "react"
import { Check, X } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { Stars } from "@/components/shared/stars"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  useReviewActions,
  useReviews,
  type ReviewStatus,
} from "@/features/reviews/hooks/use-reviews"

const FILTERS = [
  { value: "PENDING", label: "Waiting" },
  { value: "PUBLISHED", label: "Published" },
  { value: "REJECTED", label: "Rejected" },
  { value: "ALL", label: "All" },
]

const TONE: Record<ReviewStatus, "ember" | "acid" | "outline"> = {
  PENDING: "ember",
  PUBLISHED: "acid",
  REJECTED: "outline",
}

export function ReviewQueue() {
  const [page, setPage] = React.useState(1)
  const [status, setStatus] = React.useState("PENDING")

  const { data, isLoading, isError, error } = useReviews({ page, status })
  const { publish, reject } = useReviewActions()
  const busy = publish.isPending || reject.isPending

  const rows = data?.data ?? []
  const pages = data?.pagination.totalPages ?? 1

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        eyebrow="Social proof"
        title="Reviews"
        description="Nothing shows on the product page until someone here publishes it. Oldest first, so the queue drains fairly."
        actions={
          data?.pendingCount ? <Badge variant="ember">{data.pendingCount} waiting</Badge> : null
        }
      />

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => {
              setStatus(f.value)
              setPage(1)
            }}
            className={
              status === f.value
                ? "bg-blaze text-void rounded-full px-4 py-2 text-[12.5px] font-semibold"
                : "text-ash hover:text-bone rounded-full border border-white/[0.14] px-4 py-2 text-[12.5px] transition-colors hover:border-white/30"
            }
          >
            {f.label}
          </button>
        ))}
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
                  <h2 className="text-bone text-[16px] font-semibold">{r.title}</h2>
                  <p className="text-dim mt-1 font-mono text-[11.5px]">
                    {r.authorName}
                    {r.city ? `, ${r.city}` : ""} on {r.product.name} ·{" "}
                    {new Date(r.createdAt).toLocaleDateString("en-IN")}
                  </p>
                </div>

                {r.status === "PENDING" ? (
                  <div className="flex gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      className="px-3"
                      disabled={busy}
                      onClick={() => publish.mutate(r.id)}
                    >
                      <Check className="size-3.5" strokeWidth={2.4} />
                      Publish
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="px-3"
                      disabled={busy}
                      onClick={() => reject.mutate(r.id)}
                    >
                      <X className="size-3.5" strokeWidth={2.4} />
                      Reject
                    </Button>
                  </div>
                ) : r.status === "REJECTED" ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => publish.mutate(r.id)}
                  >
                    Publish anyway
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => reject.mutate(r.id)}
                  >
                    Take down
                  </Button>
                )}
              </div>

              <p className="text-ash text-[14.5px] leading-[1.7]">{r.body}</p>
            </article>
          ))}
        </div>
      )}

      {pages > 1 ? (
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="text-dim font-mono text-[12px]">
            Page {page} of {pages}
          </span>
          <Button
            variant="ghost"
            size="sm"
            disabled={page >= pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      ) : null}
    </div>
  )
}
