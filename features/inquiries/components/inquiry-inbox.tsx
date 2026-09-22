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
                  ? "bg-blaze text-void rounded-full px-4 py-2 text-[12.5px] font-semibold"
                  : "text-ash hover:text-bone rounded-full border border-white/[0.14] px-4 py-2 text-[12.5px] transition-colors hover:border-white/30"
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
        <div className="rounded-card h-80 animate-pulse bg-white/5" />
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
            <article key={i.id} className="rounded-card bg-carbon border border-white/[0.09] p-6">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2.5">
                    <Badge variant={TONE[i.status]}>{i.status}</Badge>
                    <Badge variant="muted">{i.topic}</Badge>
                    {i.orderNumber ? (
                      <span className="text-ember font-mono text-[11.5px]">{i.orderNumber}</span>
                    ) : null}
                  </div>
                  <h2 className="text-bone text-[16px] font-semibold">{i.name}</h2>
                  <div className="text-ash mt-1.5 flex flex-wrap gap-4 font-mono text-[12px]">
                    <a
                      href={`mailto:${i.email}`}
                      className="hover:text-bone flex items-center gap-1.5"
                    >
                      <Mail className="size-3.5" strokeWidth={1.9} />
                      {i.email}
                    </a>
                    {i.phone ? (
                      <a
                        href={`tel:${i.phone}`}
                        className="hover:text-bone flex items-center gap-1.5"
                      >
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

              <p className="text-ash text-[14.5px] leading-[1.7] whitespace-pre-wrap">
                {i.message}
              </p>
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
