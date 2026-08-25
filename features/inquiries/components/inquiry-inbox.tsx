"use client"

import * as React from "react"
import { Mail, Phone } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  useInquiries,
  useInquiryActions,
  type InquiryStatus,
} from "@/features/inquiries/hooks/use-inquiries"
import { useDebounce } from "@/hooks/use-debounce"

const FILTERS = [
  { value: "NEW", label: "New" },
  { value: "OPEN", label: "Open" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "ALL", label: "All" },
]

const TONE: Record<InquiryStatus, "ember" | "violet" | "acid"> = {
  NEW: "ember",
  OPEN: "violet",
  RESOLVED: "acid",
}

export function InquiryInbox() {
  const [page, setPage] = React.useState(1)
  const [status, setStatus] = React.useState("NEW")
  const [search, setSearch] = React.useState("")
  const q = useDebounce(search, 300)

  const { data, isLoading, isError, error } = useInquiries({ page, status, q })
  const setStatusFor = useInquiryActions()

  const rows = data?.data ?? []
  const pages = data?.pagination.totalPages ?? 1

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        eyebrow="Support"
        title="Inquiries"
        description="Everything sent through the contact form. Oldest first, so whoever has waited longest gets answered first."
        actions={data?.newCount ? <Badge variant="ember">{data.newCount} new</Badge> : null}
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
                  ? "rounded-full bg-blaze px-4 py-2 text-[12.5px] font-semibold text-void"
                  : "rounded-full border border-white/[0.14] px-4 py-2 text-[12.5px] text-ash transition-colors hover:border-white/30 hover:text-bone"
              }
            >
              {f.label}
            </button>
          ))}
        </div>

        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
          placeholder="Name, email or order number"
          aria-label="Search inquiries"
          className="h-11 sm:w-72"
        />
      </div>

      {isLoading ? (
        <div className="h-80 animate-pulse rounded-card bg-white/5" />
      ) : isError ? (
        <EmptyState
          title="Could not load inquiries"
          description={error instanceof Error ? error.message : "Try again in a moment."}
        />
      ) : rows.length === 0 ? (
        <EmptyState title="Inbox is clear" description="Nothing is waiting on you right now." />
      ) : (
        <div className="flex flex-col gap-4">
          {rows.map((i) => (
            <article key={i.id} className="rounded-card border border-white/[0.09] bg-carbon p-6">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2.5">
                    <Badge variant={TONE[i.status]}>{i.status}</Badge>
                    <Badge variant="muted">{i.topic}</Badge>
                    {i.orderNumber ? (
                      <span className="font-mono text-[11.5px] text-ember">{i.orderNumber}</span>
                    ) : null}
                  </div>
                  <h2 className="text-[16px] font-semibold text-bone">{i.name}</h2>
                  <div className="mt-1.5 flex flex-wrap gap-4 font-mono text-[12px] text-ash">
                    <a href={`mailto:${i.email}`} className="flex items-center gap-1.5 hover:text-bone">
                      <Mail className="size-3.5" strokeWidth={1.9} />
                      {i.email}
                    </a>
                    {i.phone ? (
                      <a href={`tel:${i.phone}`} className="flex items-center gap-1.5 hover:text-bone">
                        <Phone className="size-3.5" strokeWidth={1.9} />
                        {i.phone}
                      </a>
                    ) : null}
                    <span className="text-dim">
                      {new Date(i.createdAt).toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  {i.status !== "OPEN" && i.status !== "RESOLVED" ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={setStatusFor.isPending}
                      onClick={() => setStatusFor.mutate({ id: i.id, status: "OPEN" })}
                    >
                      Pick up
                    </Button>
                  ) : null}
                  {i.status !== "RESOLVED" ? (
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={setStatusFor.isPending}
                      onClick={() => setStatusFor.mutate({ id: i.id, status: "RESOLVED" })}
                    >
                      Resolve
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={setStatusFor.isPending}
                      onClick={() => setStatusFor.mutate({ id: i.id, status: "OPEN" })}
                    >
                      Reopen
                    </Button>
                  )}
                </div>
              </div>

              <p className="text-[14.5px] leading-[1.7] whitespace-pre-wrap text-ash">{i.message}</p>
            </article>
          ))}
        </div>
      )}

      {pages > 1 ? (
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="font-mono text-[12px] text-dim">
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
