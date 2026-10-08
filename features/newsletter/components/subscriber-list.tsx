"use client"

import * as React from "react"
import { Mail } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { Badge } from "@/components/ui/badge"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { DataTable, type Column, type DataTableHandle } from "@/components/ui/data-table"
import { ExportMenu } from "@/components/ui/export-menu"
import { HeaderButton, HeaderLink } from "@/components/ui/header-button"
import { TableSearch } from "@/components/ui/table-search"
import { ViewMenu } from "@/components/ui/view-menu"
import {
  useSubscriberActions,
  useSubscribers,
  type SubscriberRow,
} from "@/features/newsletter/hooks/use-newsletter"
import { useDebounce } from "@/hooks/use-debounce"

type Filter = "ALL" | "SUBSCRIBED" | "UNSUBSCRIBED"

const SOURCE: Record<string, string> = { "drop-list": "Home page" }

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

export function SubscriberList() {
  // Opens on the people an email would reach.
  const [status, setStatus] = React.useState<Filter>("SUBSCRIBED")
  const [search, setSearch] = React.useState("")
  const q = useDebounce(search, 300)
  const [deleting, setDeleting] = React.useState<SubscriberRow | null>(null)
  const table = React.useRef<DataTableHandle<SubscriberRow>>(null)

  const { data, isLoading, isError, error } = useSubscribers({ status, q })
  const { unsubscribe, remove } = useSubscriberActions()
  // Counted over the whole list, whatever the search.
  const counts = data?.counts

  const columns: Column<SubscriberRow>[] = [
    {
      key: "email",
      header: "Email",
      value: (s) => s.email,
      cell: (s) => <span className="text-bone font-mono text-[13px]">{s.email}</span>,
    },
    {
      key: "status",
      header: "Status",
      value: (s) => s.status,
      cell: (s) =>
        s.status === "SUBSCRIBED" ? (
          <Badge variant="acid">Subscribed</Badge>
        ) : (
          <Badge variant="muted">Unsubscribed</Badge>
        ),
    },
    {
      key: "source",
      header: "Signed up on",
      value: (s) => SOURCE[s.source] ?? s.source,
      cell: (s) => <span className="text-ash text-[13px]">{SOURCE[s.source] ?? s.source}</span>,
    },
    {
      key: "joined",
      header: "Joined",
      value: (s) => s.subscribedAt,
      cell: (s) => <span className="text-dim font-mono text-[11.5px]">{when(s.subscribedAt)}</span>,
    },
    {
      key: "left",
      header: "Left",
      value: (s) => s.unsubscribedAt ?? "",
      cell: (s) => (
        <span className="text-dim font-mono text-[11.5px]">
          {s.unsubscribedAt ? when(s.unsubscribedAt) : "-"}
        </span>
      ),
    },
    {
      // No value, so it neither sorts nor exports.
      key: "actions",
      header: "",
      align: "right",
      cell: (s) => (
        <div className="flex justify-end gap-2">
          {s.status === "SUBSCRIBED" ? (
            <HeaderButton disabled={unsubscribe.isPending} onClick={() => unsubscribe.mutate(s.id)}>
              Unsubscribe
            </HeaderButton>
          ) : null}
          <HeaderButton onClick={() => setDeleting(s)}>Delete</HeaderButton>
        </div>
      ),
    },
  ]

  const bar = (
    <div className="flex items-center gap-2">
      <ViewMenu
        value={status}
        onChange={setStatus}
        options={[
          {
            value: "ALL",
            label: "All",
            count: counts ? counts.subscribed + counts.unsubscribed : undefined,
          },
          { value: "SUBSCRIBED", label: "Subscribed", count: counts?.subscribed },
          { value: "UNSUBSCRIBED", label: "Unsubscribed", count: counts?.unsubscribed },
        ]}
      />
      <TableSearch
        value={search}
        onChange={setSearch}
        placeholder="Email"
        label="Search subscribers by email"
      />
    </div>
  )

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        icon={Mail}
        title="Newsletter"
        actions={
          <>
            <ExportMenu table={table} noun={["subscriber", "subscribers"]} />
            <HeaderLink variant="primary" href="/admin/newsletter/emails">
              Write an email
            </HeaderLink>
          </>
        }
      />

      {isError ? (
        <EmptyState
          title="Could not load subscribers"
          description={error instanceof Error ? error.message : "Try again in a moment."}
        />
      ) : (
        <DataTable
          handle={table}
          rows={data?.data ?? []}
          columns={columns}
          rowId={(s) => s.id}
          exportName="newsletter-subscribers"
          exportButtons={false}
          pageKey={`${status}|${q}`}
          bar={bar}
          loading={isLoading}
          total={data?.pagination?.total}
          empty={
            q
              ? "Nobody matches that search."
              : status === "SUBSCRIBED"
                ? "Nobody has signed up yet. The Notify me form on the home page adds people here."
                : "Nothing here."
          }
          exportColumns={[
            { header: "Email", value: (s) => s.email },
            { header: "Status", value: (s) => s.status },
            { header: "Signed up on", value: (s) => SOURCE[s.source] ?? s.source },
            { header: "Joined", value: (s) => when(s.subscribedAt) },
            { header: "Left", value: (s) => (s.unsubscribedAt ? when(s.unsubscribedAt) : "") },
          ]}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        title="Delete this subscriber?"
        body={
          <>
            <span className="text-bone font-mono">{deleting?.email}</span> is erased, with the
            record of which emails reached them. For someone who asked to be forgotten; to stop
            emailing someone, Unsubscribe keeps the record of why.
          </>
        }
        confirmLabel="Delete"
        tone="danger"
        pending={remove.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return
          remove.mutate(deleting.id, { onSettled: () => setDeleting(null) })
        }}
      />
    </div>
  )
}
