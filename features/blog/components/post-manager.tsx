"use client"

import * as React from "react"
import { ExternalLink, PenLine } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { Badge } from "@/components/ui/badge"
import { Button, ButtonLink } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { DataTable, type Column } from "@/components/ui/data-table"
import { Input } from "@/components/ui/input"
import { categoryLabel } from "@/features/blog/blog"
import {
  useManagedPosts,
  usePostActions,
  type ManagedPost,
  type PostStatus,
} from "@/features/blog/hooks/use-blog"
import { listOf } from "@/features/blog/lib/managed-posts"
import { STUDIO_PATH } from "@/features/blog/sanity/env"
import { schedulePostSchema } from "@/features/blog/schemas/post.schema"
import { useConfirm } from "@/hooks/use-confirm"
import { cn } from "@/lib/utils"

const FILTERS: Array<{ value: PostStatus | "ALL"; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "DRAFT", label: "Drafts" },
  { value: "SCHEDULED", label: "Scheduled" },
  { value: "LIVE", label: "Live" },
]

const STATUS: Record<PostStatus, { label: string; variant: "muted" | "ember" | "acid" }> = {
  DRAFT: { label: "Draft", variant: "muted" },
  SCHEDULED: { label: "Scheduled", variant: "ember" },
  LIVE: { label: "Live", variant: "acid" },
}

const when = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "-"

/** A moment as a datetime-local input writes it: the clock on the wall here, no zone. */
function localInput(date: Date): string {
  const p = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}T${p(date.getHours())}:${p(date.getMinutes())}`
}

/** Tomorrow at ten in the morning: where the date picker starts. */
function tomorrowMorning(): string {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  date.setHours(10, 0, 0, 0)
  return localInput(date)
}

/** The Studio, open on one post. */
const studioLink = (id: string) => `${STUDIO_PATH}/structure/post;${id}`

/**
 * The blog, from the desk it is released from. Posts are written in the
 * Studio; here each one is published, given a time to go live, or taken down.
 *
 * Scheduling is the reason this page exists: a scheduled post is published
 * with a date still to come, and the site shows it from that moment on.
 */
export function PostManager() {
  const [filter, setFilter] = React.useState<PostStatus | "ALL">("ALL")
  const [scheduling, setScheduling] = React.useState<ManagedPost | null>(null)
  const [at, setAt] = React.useState("")
  const [atError, setAtError] = React.useState<string | null>(null)

  const { data, isLoading, isError, error } = useManagedPosts()
  const { publish, schedule, unpublish } = usePostActions()
  const { ask, dialog } = useConfirm()
  const busy = publish.isPending || schedule.isPending || unpublish.isPending

  const posts = data?.data ?? []
  const shown = filter === "ALL" ? posts : posts.filter((p) => p.status === filter)
  const canPublish = data?.canPublish ?? false

  function openSchedule(post: ManagedPost) {
    // Rescheduling starts from the time it has; a first schedule from tomorrow morning.
    const current =
      post.status === "SCHEDULED" && post.publishedAt ? new Date(post.publishedAt) : null
    setAt(current ? localInput(current) : tomorrowMorning())
    setAtError(null)
    setScheduling(post)
  }

  function confirmSchedule() {
    if (!scheduling) return
    const chosen = new Date(at)
    const parsed = schedulePostSchema.safeParse({
      at: Number.isNaN(chosen.getTime()) ? "" : chosen.toISOString(),
    })
    if (!parsed.success) {
      setAtError(parsed.error.issues[0]?.message ?? "Choose a date and time")
      return
    }
    schedule.mutate(
      { id: scheduling.id, at: parsed.data.at },
      { onSuccess: () => setScheduling(null) },
    )
  }

  const columns: Column<ManagedPost>[] = [
    {
      key: "title",
      header: "Post",
      value: (p) => p.title,
      cell: (p) => (
        <span className="block min-w-0">
          <span className="text-bone block max-w-[420px] truncate text-[14px]">{p.title}</span>
          <span className="text-dim block font-mono text-[11px]">
            {p.slug ? `/blog/${p.slug}` : "no address yet"}
          </span>
          {p.missing.length > 0 ? (
            <span className="text-ember mt-1 block text-[12px]">Needs {listOf(p.missing)}</span>
          ) : null}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      value: (p) => STATUS[p.status].label,
      cell: (p) => (
        <span className="flex items-center gap-2">
          <Badge variant={STATUS[p.status].variant}>{STATUS[p.status].label}</Badge>
          {p.hasChanges ? <Badge variant="violet">Unpublished edits</Badge> : null}
        </span>
      ),
    },
    {
      key: "goesLive",
      header: "Goes live",
      // A draft's date is only what it was last published with: not shown as a plan.
      value: (p) => (p.status === "DRAFT" ? "" : (p.publishedAt ?? "")),
      cell: (p) => (
        <span
          className={cn(
            "font-mono text-[11.5px]",
            p.status === "SCHEDULED" ? "text-ember" : "text-dim",
          )}
        >
          {p.status === "DRAFT" ? "-" : when(p.publishedAt)}
        </span>
      ),
    },
    {
      key: "category",
      header: "Category",
      value: (p) => (p.category ? categoryLabel(p.category) : ""),
      cell: (p) => (
        <span className="text-ash text-[13px]">{p.category ? categoryLabel(p.category) : "-"}</span>
      ),
    },
    {
      key: "edited",
      header: "Edited",
      value: (p) => p.updatedAt,
      cell: (p) => <span className="text-dim font-mono text-[11.5px]">{when(p.updatedAt)}</span>,
    },
    {
      // No value: buttons are not data, so this neither sorts nor exports.
      key: "actions",
      header: "",
      align: "right",
      cell: (p) => {
        const ready = p.missing.length === 0
        // A draft, a scheduled post, or a live one with edits waiting.
        const canGoOut = p.status !== "LIVE" || p.hasChanges
        return (
          <div className="flex justify-end gap-2">
            {canPublish && canGoOut ? (
              <Button
                variant="ghost"
                size="xs"
                disabled={busy || !ready}
                onClick={() =>
                  ask({
                    title: p.status === "LIVE" ? "Publish the edits?" : "Publish this post now?",
                    body:
                      p.status === "LIVE"
                        ? `The edits made to "${p.title}" in the Studio replace what is on the site. Its date stays as it is.`
                        : `"${p.title}" goes on the site straight away, dated now.`,
                    confirmLabel: p.status === "LIVE" ? "Publish edits" : "Publish now",
                    run: (done) => publish.mutate(p.id, { onSettled: done }),
                  })
                }
              >
                {p.status === "LIVE" ? "Publish edits" : "Publish now"}
              </Button>
            ) : null}
            {canPublish && p.status !== "LIVE" ? (
              <Button
                variant="ghost"
                size="xs"
                disabled={busy || !ready}
                onClick={() => openSchedule(p)}
              >
                {p.status === "SCHEDULED" ? "Reschedule" : "Schedule"}
              </Button>
            ) : null}
            {canPublish && p.status !== "DRAFT" ? (
              <Button
                variant="ghost"
                size="xs"
                disabled={busy}
                onClick={() =>
                  ask({
                    title: p.status === "LIVE" ? "Take this post down?" : "Cancel the schedule?",
                    body:
                      p.status === "LIVE"
                        ? `"${p.title}" comes off the site and its address answers Not found. It is kept as a draft, and can be published again.`
                        : `"${p.title}" will not go live. It is kept as a draft.`,
                    confirmLabel: p.status === "LIVE" ? "Take down" : "Cancel schedule",
                    tone: "danger",
                    run: (done) => unpublish.mutate(p.id, { onSettled: done }),
                  })
                }
              >
                {p.status === "LIVE" ? "Take down" : "Unschedule"}
              </Button>
            ) : null}
            <ButtonLink href={studioLink(p.id)} target="_blank" variant="ghost" size="xs">
              Edit
            </ButtonLink>
            {p.status === "LIVE" && p.slug ? (
              <ButtonLink
                href={`/blog/${p.slug}`}
                target="_blank"
                variant="ghost"
                size="xs"
                aria-label={`View ${p.title} on the site`}
              >
                <ExternalLink className="size-3.5" strokeWidth={2} />
              </ButtonLink>
            ) : null}
          </div>
        )
      },
    },
  ]

  return (
    <div className="flex flex-col gap-7">
      {dialog}
      <PageHeader
        eyebrow="Marketing"
        title="Blog"
        description="Posts are written in the Studio. From here each one is published, given a time to go live, or taken down. A scheduled post goes on the site by itself when its time comes."
        actions={
          <ButtonLink
            href={`${STUDIO_PATH}/structure/post`}
            target="_blank"
            variant="primary"
            size="sm"
            className="gap-2"
          >
            <PenLine className="size-4" strokeWidth={2} />
            Write a post
          </ButtonLink>
        }
      />

      <div className="grid grid-cols-3 gap-3 sm:max-w-xl">
        <Stat label="Drafts" value={data?.counts.DRAFT} tone="text-ash" />
        <Stat label="Scheduled" value={data?.counts.SCHEDULED} tone="text-ember" />
        <Stat label="Live" value={data?.counts.LIVE} tone="text-acid" />
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={
              filter === f.value
                ? "bg-blaze text-void rounded-md px-4 py-2 text-[12.5px] font-semibold"
                : "text-ash hover:text-bone rounded-md border border-white/[0.14] px-4 py-2 text-[12.5px] transition-colors hover:border-white/30"
            }
          >
            {f.label}
          </button>
        ))}
      </div>

      {isError ? (
        <EmptyState
          title="The blog cannot be managed yet"
          description={error instanceof Error ? error.message : "Try again in a moment."}
        />
      ) : (
        <DataTable
          rows={shown}
          columns={columns}
          rowId={(p) => p.id}
          exportName="blog-posts"
          loading={isLoading}
          total={shown.length}
          empty={
            filter === "ALL"
              ? "No posts yet. Write a post opens the Studio; what is written there appears here."
              : "Nothing here."
          }
          exportColumns={[
            { header: "Title", value: (p) => p.title },
            { header: "Address", value: (p) => (p.slug ? `/blog/${p.slug}` : "") },
            { header: "Status", value: (p) => STATUS[p.status].label },
            {
              header: "Goes live",
              value: (p) => (p.status === "DRAFT" ? "" : when(p.publishedAt)),
            },
            { header: "Category", value: (p) => (p.category ? categoryLabel(p.category) : "") },
            { header: "Edited", value: (p) => when(p.updatedAt) },
          ]}
        />
      )}

      <ConfirmDialog
        open={scheduling !== null}
        title={scheduling?.status === "SCHEDULED" ? "Move the schedule?" : "Schedule this post?"}
        body={
          <div className="flex flex-col gap-3">
            <p>
              <span className="text-bone">{scheduling?.title}</span> is published now with this time
              as its date, and stays off the site until then.
            </p>
            <label className="flex flex-col gap-2">
              <span className="text-dim font-mono text-[10.5px] tracking-[0.16em] uppercase">
                Goes live at
              </span>
              <Input
                type="datetime-local"
                value={at}
                min={localInput(new Date())}
                onChange={(e) => {
                  setAt(e.target.value)
                  setAtError(null)
                }}
                aria-invalid={Boolean(atError) || undefined}
                className="font-mono"
              />
            </label>
            {atError ? (
              <span role="alert" className="text-magenta text-[12.5px]">
                {atError}
              </span>
            ) : (
              <span className="text-dim text-[12.5px]">
                Your own clock, as this computer shows it. The site may take a minute or two past
                the time to show the post.
              </span>
            )}
          </div>
        }
        confirmLabel={scheduling?.status === "SCHEDULED" ? "Move schedule" : "Schedule"}
        pending={schedule.isPending}
        onClose={() => setScheduling(null)}
        onConfirm={confirmSchedule}
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
