"use client"

import * as React from "react"
import { Send } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { Badge } from "@/components/ui/badge"
import { Button, ButtonLink } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { DataTable, type Column } from "@/components/ui/data-table"
import { Input } from "@/components/ui/input"
import {
  useSubscriberActions,
  useSubscribers,
  type SubscriberRow,
} from "@/features/newsletter/hooks/use-newsletter"
import { useDebounce } from "@/hooks/use-debounce"
import { cn } from "@/lib/utils"

const FILTERS = [
  { value: "SUBSCRIBED", label: "Subscribed" },
  { value: "UNSUBSCRIBED", label: "Unsubscribed" },
  { value: "ALL", label: "All" },
]

const SOURCE: Record<string, string> = { "drop-list": "Home page" }

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

/**
 * The drop list: everyone who pressed "Notify me" on the home page, with the
 * date they joined and, if they left, the date they left. Export gives the
 * list as a spreadsheet; Write an email sends to it from here.
 */
export function SubscriberList() {
  const [status, setStatus] = React.useState("SUBSCRIBED")
  const [search, setSearch] = React.useState("")
  const q = useDebounce(search, 300)
  const [deleting, setDeleting] = React.useState<SubscriberRow | null>(null)

  const { data, isLoading, isError, error } = useSubscribers({ status, q })
  const { unsubscribe, remove } = useSubscriberActions()
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
      // No value: buttons are not data, so this neither sorts nor exports.
      key: "actions",
      header: "",
      align: "right",
      cell: (s) => (
        <div className="flex justify-end gap-2">
          {s.status === "SUBSCRIBED" ? (
            <Button
              variant="ghost"
              size="xs"
              disabled={unsubscribe.isPending}
              onClick={() => unsubscribe.mutate(s.id)}
            >
              Unsubscribe
            </Button>
          ) : null}
          <Button variant="ghost" size="xs" onClick={() => setDeleting(s)}>
            Delete
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        eyebrow="Console"
        title="Newsletter"
        description="Everyone who pressed Notify me on the home page. Email them about new drops from Write an email; each email carries its own unsubscribe link."
        actions={
          <ButtonLink href="/admin/newsletter/emails" variant="primary" size="sm" className="gap-2">
            <Send className="size-4" strokeWidth={2} />
            Write an email
          </ButtonLink>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:max-w-md">
        <Stat label="Subscribed" value={counts?.subscribed} tone="text-acid" />
        <Stat label="Unsubscribed" value={counts?.unsubscribed} tone="text-dim" />
      </div>

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
          placeholder="Search by email"
          aria-label="Search subscribers"
          className="h-11 sm:w-72"
        />
      </div>

      {isError ? (
        <EmptyState
          title="Could not load subscribers"
          description={error instanceof Error ? error.message : "Try again in a moment."}
        />
      ) : (
        <DataTable
          rows={data?.data ?? []}
          columns={columns}
          rowId={(s) => s.id}
          exportName="newsletter-subscribers"
          loading={isLoading}
          total={data?.pagination?.total}
          empty={
            status === "SUBSCRIBED"
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

function Stat({ label, value, tone }: { label: string; value?: number; tone: string }) {
  return (
    <div className="bg-carbon rounded-md border border-white/[0.09] px-5 py-4">
      <div className="text-dim font-mono text-[10.5px] tracking-[0.14em] uppercase">{label}</div>
      <div className={cn("font-display mt-1 text-[30px] leading-none", tone)}>{value ?? "–"}</div>
    </div>
  )
}
