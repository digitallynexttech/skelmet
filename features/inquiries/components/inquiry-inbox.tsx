"use client"

import * as React from "react"
import { Mail, Phone } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DataTable, type Column } from "@/components/ui/data-table"
import { Input } from "@/components/ui/input"
import {
  useInquiries,
  useInquiryActions,
  type InquiryRow,
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

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })

export function InquiryInbox() {
  const [status, setStatus] = React.useState("NEW")
  const [search, setSearch] = React.useState("")
  const q = useDebounce(search, 300)

  const { data, isLoading, isError, error } = useInquiries({ page: 1, status, q })
  const setStatusFor = useInquiryActions()

  const columns: Column<InquiryRow>[] = [
    {
      key: "status",
      header: "Status",
      value: (i) => i.status,
      cell: (i) => <Badge variant={TONE[i.status]}>{i.status}</Badge>,
    },
    {
      key: "name",
      header: "From",
      value: (i) => i.name,
      cell: (i) => (
        <span className="block min-w-0">
          <span className="text-bone block truncate text-[14px] font-semibold">{i.name}</span>
          <a
            href={`mailto:${i.email}`}
            className="text-dim hover:text-bone flex items-center gap-1.5 font-mono text-[11.5px] transition-colors"
          >
            <Mail className="size-3" strokeWidth={1.9} />
            {i.email}
          </a>
        </span>
      ),
    },
    {
      key: "topic",
      header: "Topic",
      value: (i) => i.topic,
      cell: (i) => <Badge variant="muted">{i.topic}</Badge>,
    },
    {
      key: "order",
      header: "Order",
      value: (i) => i.orderNumber ?? "",
      cell: (i) =>
        i.orderNumber ? (
          <span className="text-ember font-mono text-[11.5px]">{i.orderNumber}</span>
        ) : (
          <span className="text-dim">—</span>
        ),
    },
    {
      key: "phone",
      header: "Phone",
      value: (i) => i.phone ?? "",
      cell: (i) =>
        i.phone ? (
          <a
            href={`tel:${i.phone}`}
            className="text-ash hover:text-bone flex items-center gap-1.5 font-mono text-[12px] transition-colors"
          >
            <Phone className="size-3" strokeWidth={1.9} />
            {i.phone}
          </a>
        ) : (
          <span className="text-dim">—</span>
        ),
    },
    {
      key: "received",
      header: "Received",
      align: "right",
      value: (i) => i.createdAt,
      cell: (i) => <span className="text-dim font-mono text-[11.5px]">{when(i.createdAt)}</span>,
    },
    {
      // No value: buttons are not data, so this neither sorts nor exports.
      key: "actions",
      header: "",
      align: "right",
      cell: (i) => (
        <div className="flex justify-end gap-2">
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
      ),
    },
  ]

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
              onClick={() => setStatus(f.value)}
              className={
                status === f.value
                  ? "bg-blaze text-void rounded-md px-4 py-2 text-[12.5px] font-semibold"
                  : "text-ash hover:text-bone rounded-md border border-white/[0.14] px-4 py-2 text-[12.5px] transition-colors hover:border-white/30"
              }
            >
              {f.label}
            </button>
          ))}
        </div>

        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Name, email or order number"
          aria-label="Search inquiries"
          className="h-11 sm:w-72"
        />
      </div>

      {isError ? (
        <EmptyState
          title="Could not load inquiries"
          description={error instanceof Error ? error.message : "Try again in a moment."}
        />
      ) : (
        <DataTable
          rows={data?.data ?? []}
          columns={columns}
          rowId={(i) => i.id}
          exportName="inquiries"
          loading={isLoading}
          total={data?.pagination?.total}
          empty="Inbox is clear. Nothing is waiting on you right now."
          // The message is the point of the row and will not fit in a cell,
          // so it opens underneath instead of being truncated into nonsense.
          expandable={(i) => (
            <p className="text-ash max-w-[80ch] text-[14.5px] leading-[1.7] whitespace-pre-wrap">
              {i.message}
            </p>
          )}
          exportColumns={[
            { header: "Status", value: (i) => i.status },
            { header: "Name", value: (i) => i.name },
            { header: "Email", value: (i) => i.email },
            { header: "Phone", value: (i) => i.phone ?? "" },
            { header: "Topic", value: (i) => i.topic },
            { header: "Order", value: (i) => i.orderNumber ?? "" },
            { header: "Message", value: (i) => i.message },
            { header: "Received", value: (i) => when(i.createdAt) },
          ]}
        />
      )}
    </div>
  )
}
