"use client"

import * as React from "react"
import { Mail, MessageSquare, Phone } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { Badge } from "@/components/ui/badge"
import { DataTable, type Column, type DataTableHandle } from "@/components/ui/data-table"
import { ExportMenu } from "@/components/ui/export-menu"
import { TableSearch } from "@/components/ui/table-search"
import { ViewMenu } from "@/components/ui/view-menu"
import { HeaderButton } from "@/components/ui/header-button"
import {
  useInquiries,
  useInquiryActions,
  type InquiryRow,
  type InquiryStatus,
} from "@/features/inquiries/hooks/use-inquiries"
import { useDebounce } from "@/hooks/use-debounce"

type Filter = InquiryStatus | "ALL"

// All first, as every view menu has it; the inbox still opens on New.
const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "NEW", label: "New" },
  { value: "OPEN", label: "Open" },
  { value: "RESOLVED", label: "Resolved" },
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
  const [status, setStatus] = React.useState<Filter>("NEW")
  const [search, setSearch] = React.useState("")
  const q = useDebounce(search, 300)

  const { data, isLoading, isError, error } = useInquiries({ page: 1, status, q })
  const setStatusFor = useInquiryActions()
  const table = React.useRef<DataTableHandle<InquiryRow>>(null)

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
          <span className="text-dim">-</span>
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
          <span className="text-dim">-</span>
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
      // No value: neither sorts nor exports.
      key: "actions",
      header: "",
      align: "right",
      cell: (i) => (
        <div className="flex justify-end gap-2">
          {i.status !== "OPEN" && i.status !== "RESOLVED" ? (
            <HeaderButton
              disabled={setStatusFor.isPending}
              onClick={() => setStatusFor.mutate({ id: i.id, status: "OPEN" })}
            >
              Pick up
            </HeaderButton>
          ) : null}
          {i.status !== "RESOLVED" ? (
            <HeaderButton
              variant="primary"
              disabled={setStatusFor.isPending}
              onClick={() => setStatusFor.mutate({ id: i.id, status: "RESOLVED" })}
            >
              Resolve
            </HeaderButton>
          ) : (
            <HeaderButton
              disabled={setStatusFor.isPending}
              onClick={() => setStatusFor.mutate({ id: i.id, status: "OPEN" })}
            >
              Reopen
            </HeaderButton>
          )}
        </div>
      ),
    },
  ]

  const bar = (
    <div className="flex items-center gap-2">
      <ViewMenu
        value={status}
        onChange={setStatus}
        // New counts every new inquiry, whatever the search.
        options={FILTERS.map((f) => ({
          ...f,
          count: f.value === "NEW" ? data?.newCount : undefined,
        }))}
      />
      <TableSearch
        value={search}
        onChange={setSearch}
        placeholder="Name, email or order number"
        label="Search inquiries by name, email or order number"
      />
    </div>
  )

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        icon={MessageSquare}
        title="Inquiries"
        actions={<ExportMenu table={table} noun={["inquiry", "inquiries"]} />}
      />

      {isError ? (
        <EmptyState
          title="Could not load inquiries"
          description={error instanceof Error ? error.message : "Try again in a moment."}
        />
      ) : (
        <DataTable
          handle={table}
          rows={data?.data ?? []}
          columns={columns}
          rowId={(i) => i.id}
          exportName="inquiries"
          exportButtons={false}
          pageKey={`${status}|${q}`}
          bar={bar}
          loading={isLoading}
          total={data?.pagination?.total}
          empty={
            q
              ? "No inquiry matches that search."
              : "Inbox is clear. Nothing is waiting on you right now."
          }
          // The message opens underneath rather than being truncated in a cell.
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
