"use client"

import * as React from "react"
import { toast } from "sonner"

import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { DataTable, type Column } from "@/components/ui/data-table"
import { Field, Input, Textarea } from "@/components/ui/input"
import { siteConfig } from "@/config/site"
import {
  useCampaigns,
  useResumeCampaign,
  useSendCampaign,
  type CampaignRow,
} from "@/features/newsletter/hooks/use-newsletter"
import { sendCampaignSchema } from "@/features/newsletter/schemas/newsletter.schema"
import { ApiFetchError } from "@/lib/api-fetch"

type Draft = { subject: string; body: string; ctaLabel: string; ctaUrl: string }

const EMPTY: Draft = { subject: "", body: "", ctaLabel: "", ctaUrl: "" }

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })

/** The message as the email lays it out: a blank line between paragraphs. */
const paragraphs = (body: string) =>
  body
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)

/**
 * Write an email to the drop list, try it on yourself, send it, and watch it
 * go. One at a time: a second one waits until the first has finished.
 */
export function NewsletterEmails() {
  const [draft, setDraft] = React.useState<Draft>(EMPTY)
  const [errors, setErrors] = React.useState<Partial<Record<keyof Draft, string>>>({})
  const [confirming, setConfirming] = React.useState(false)

  const { data, isLoading, isError, error } = useCampaigns()
  const send = useSendCampaign()
  const resume = useResumeCampaign()

  const subscribed = data?.subscribed ?? 0
  const busy = data?.data.some((c) => c.running) ?? false

  const set =
    (key: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setDraft((d) => ({ ...d, [key]: e.target.value }))
      if (errors[key]) setErrors((x) => ({ ...x, [key]: undefined }))
    }

  /** The same schema the server checks, so a bad field is caught before the request. */
  function valid(): boolean {
    const parsed = sendCampaignSchema.safeParse(draft)
    if (parsed.success) {
      setErrors({})
      return true
    }
    const next: Partial<Record<keyof Draft, string>> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof Draft
      next[key] ??= issue.message
    }
    setErrors(next)
    return false
  }

  function submit(test: boolean) {
    send.mutate(
      { ...draft, test },
      {
        onSuccess: (result) => {
          if (result.test) {
            toast.success(`Test sent to ${result.to}. Check that inbox.`)
          } else {
            toast.success(
              `Sending to ${result.recipients} ${result.recipients === 1 ? "person" : "people"}.`,
            )
            setDraft(EMPTY)
          }
          setConfirming(false)
        },
        onError: (err) => {
          setConfirming(false)
          toast.error(err instanceof ApiFetchError ? err.message : "That didn't work. Try again.")
        },
      },
    )
  }

  const columns: Column<CampaignRow>[] = [
    {
      key: "subject",
      header: "Subject",
      value: (c) => c.subject,
      cell: (c) => <span className="text-bone text-[14px]">{c.subject}</span>,
    },
    {
      key: "status",
      header: "Status",
      value: (c) => c.status,
      cell: (c) => (
        <CampaignStatus
          campaign={c}
          onResume={() => resume.mutate(c.id)}
          resuming={resume.isPending}
        />
      ),
    },
    {
      key: "delivered",
      header: "Delivered",
      align: "right",
      value: (c) => c.sent,
      cell: (c) => (
        <span className="text-bone font-mono text-[13px]">
          {c.sent}
          <span className="text-dim"> / {c.recipients}</span>
        </span>
      ),
    },
    {
      key: "failed",
      header: "Failed",
      align: "right",
      value: (c) => c.failed,
      cell: (c) => (
        <span
          className={
            c.failed ? "text-magenta font-mono text-[13px]" : "text-dim font-mono text-[13px]"
          }
        >
          {c.failed}
        </span>
      ),
    },
    {
      key: "by",
      header: "Sent by",
      value: (c) => c.sentByEmail ?? "",
      cell: (c) => <span className="text-dim font-mono text-[11.5px]">{c.sentByEmail ?? "-"}</span>,
    },
    {
      key: "when",
      header: "Sent",
      align: "right",
      value: (c) => c.createdAt,
      cell: (c) => <span className="text-dim font-mono text-[11.5px]">{when(c.createdAt)}</span>,
    },
  ]

  const preview = paragraphs(draft.body)

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Newsletter"
        title="Write an email"
        description="Goes to everyone subscribed, one email each with their own unsubscribe link. Send yourself a test first to see it in a real inbox."
        actions={<Badge variant="acid">{subscribed} subscribed</Badge>}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px] xl:items-start">
        <form
          className="bg-carbon flex flex-col gap-5 rounded-md border border-white/[0.09] p-6"
          onSubmit={(e) => {
            e.preventDefault()
            if (valid()) setConfirming(true)
          }}
        >
          <Field label="Subject" error={errors.subject}>
            <Input
              value={draft.subject}
              onChange={set("subject")}
              maxLength={120}
              placeholder="The Ghost Grey skull is here"
            />
          </Field>

          <Field
            label="Message"
            error={errors.body}
            hint="A blank line starts a new paragraph. Web addresses become links."
          >
            <Textarea
              value={draft.body}
              onChange={set("body")}
              rows={10}
              maxLength={10_000}
              placeholder={"Hey rider,\n\nThe skull you've been waiting for just dropped..."}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-[200px_minmax(0,1fr)]">
            <Field label="Button text" error={errors.ctaLabel}>
              <Input
                value={draft.ctaLabel}
                onChange={set("ctaLabel")}
                maxLength={40}
                placeholder="Shop now"
              />
            </Field>
            <Field
              label="Button link"
              error={errors.ctaUrl}
              hint="Optional. Leave empty for no button."
            >
              <Input
                value={draft.ctaUrl}
                onChange={set("ctaUrl")}
                inputMode="url"
                placeholder={`${siteConfig.url}/product/flame-skull-mount`}
                className="font-mono text-[13.5px]"
              />
            </Field>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={send.isPending}
              onClick={() => valid() && submit(true)}
            >
              Send a test to me
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={send.isPending || busy || subscribed === 0}
            >
              Send to {subscribed} {subscribed === 1 ? "subscriber" : "subscribers"}
            </Button>
            {busy ? (
              <span className="text-dim text-[12.5px]">
                One is still sending; this waits for it.
              </span>
            ) : null}
          </div>

          <p className="text-dim text-[12.5px] leading-[1.6]">
            Sent from the shop&apos;s Gmail account, about 40 a minute. Gmail allows around 500
            emails a day; past that the email pauses here and Resume sends the rest the next day.
          </p>
        </form>

        {/* A sketch of the email, not the email: the test shows the real one. */}
        <div className="bg-void rounded-md border border-white/[0.09] p-5">
          <div className="text-dim mb-4 font-mono text-[10.5px] tracking-[0.14em] uppercase">
            Preview
          </div>
          <div className="bg-carbon rounded-[12px] border border-white/[0.09] p-5">
            <h3 className="text-bone mb-3 text-[18px] leading-[1.3] font-extrabold">
              {draft.subject || "Your subject"}
            </h3>
            {preview.length ? (
              preview.map((p, i) => (
                <p key={i} className="text-ash mb-3 text-[14px] leading-[1.65] whitespace-pre-line">
                  {p}
                </p>
              ))
            ) : (
              <p className="text-dim text-[14px] leading-[1.65]">Your message.</p>
            )}
            {draft.ctaUrl ? (
              <span className="bg-blaze text-void mt-2 inline-block rounded-[9px] px-5 py-2.5 text-[13px] font-bold">
                {draft.ctaLabel || "Take a look"}
              </span>
            ) : null}
          </div>
          <p className="text-dim mt-3 text-[11.5px] leading-[1.6]">
            Every email ends with a line saying why they got it, and an Unsubscribe link.
          </p>
        </div>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-bone text-[22px] tracking-[0.02em] uppercase">Sent</h2>
        {isError ? (
          <EmptyState
            title="Could not load sent emails"
            description={error instanceof Error ? error.message : "Try again in a moment."}
          />
        ) : (
          <DataTable
            rows={data?.data ?? []}
            columns={columns}
            rowId={(c) => c.id}
            exportName="newsletter-emails"
            loading={isLoading}
            empty="Nothing sent yet."
            expandable={(c) => (
              <div className="max-w-[80ch]">
                {c.note && !c.running ? (
                  <p className="text-ember mb-3 text-[13px] leading-[1.6]">{c.note}</p>
                ) : null}
                <p className="text-ash text-[14px] leading-[1.7] whitespace-pre-wrap">{c.body}</p>
                {c.ctaUrl ? (
                  <p className="text-dim mt-3 font-mono text-[12px]">
                    {c.ctaLabel || "Take a look"} → {c.ctaUrl}
                  </p>
                ) : null}
              </div>
            )}
          />
        )}
      </section>

      <ConfirmDialog
        open={confirming}
        title={`Send to ${subscribed} ${subscribed === 1 ? "person" : "people"}?`}
        body={
          <>
            &ldquo;<span className="text-bone">{draft.subject}</span>&rdquo; goes to everyone
            subscribed. It cannot be taken back once it starts.
          </>
        }
        confirmLabel="Send it"
        pending={send.isPending}
        onClose={() => setConfirming(false)}
        onConfirm={() => submit(false)}
      />
    </div>
  )
}

function CampaignStatus({
  campaign: c,
  onResume,
  resuming,
}: {
  campaign: CampaignRow
  onResume: () => void
  resuming: boolean
}) {
  if (c.running) {
    return (
      <span className="flex items-center gap-2">
        <Badge variant="violet">Sending</Badge>
        <span className="text-dim font-mono text-[11.5px]">
          {c.sent + c.failed} of {c.recipients}
        </span>
      </span>
    )
  }
  if (c.status === "SENT") return <Badge variant="acid">Sent</Badge>

  // PAUSED at the daily limit, or SENDING but cut off by a restart.
  const note = c.status === "PAUSED" ? c.note : "Stopped when the server restarted."
  return (
    <span className="flex items-center gap-3">
      <Badge variant={c.status === "PAUSED" ? "ember" : "magenta"}>
        {c.status === "PAUSED" ? "Paused" : "Stopped"}
      </Badge>
      <Button variant="ghost" size="xs" disabled={resuming} onClick={onResume}>
        Resume
      </Button>
      {note ? (
        <span className="text-dim max-w-[340px] truncate text-[12px]" title={note}>
          {note}
        </span>
      ) : null}
    </span>
  )
}
