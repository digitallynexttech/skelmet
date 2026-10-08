"use client"

import * as React from "react"
import { Mail } from "lucide-react"
import { toast } from "sonner"

import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { Badge } from "@/components/ui/badge"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { DataTable, type Column } from "@/components/ui/data-table"
import type { JSONContent } from "@tiptap/react"

import { Field, Input, Label } from "@/components/ui/input"
import { HeaderButton } from "@/components/ui/header-button"
import { siteConfig } from "@/config/site"
import { EMPTY_DOC, RichEditor } from "@/features/newsletter/components/rich-editor"
import { renderNewsletter } from "@/features/newsletter/emails/newsletter-email"
import {
  useCampaigns,
  useResumeCampaign,
  useSendCampaign,
  type CampaignRow,
} from "@/features/newsletter/hooks/use-newsletter"
import type { NewsletterDoc } from "@/features/newsletter/newsletter-content"
import { sendCampaignSchema } from "@/features/newsletter/schemas/newsletter.schema"
import { useDebounce } from "@/hooks/use-debounce"
import { ApiFetchError } from "@/lib/api-fetch"

type Draft = { subject: string; content: JSONContent; ctaLabel: string; ctaUrl: string }

const EMPTY: Draft = { subject: "", content: EMPTY_DOC, ctaLabel: "", ctaUrl: "" }

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })

/** Write, test and send an email to the drop list. One campaign sends at a time. */
export function NewsletterEmails() {
  const [draft, setDraft] = React.useState<Draft>(EMPTY)
  const [errors, setErrors] = React.useState<Partial<Record<keyof Draft, string>>>({})
  const [confirming, setConfirming] = React.useState(false)
  // Bumped to remount the editor, which reads its content only once.
  const [editorKey, setEditorKey] = React.useState(0)

  const { data, isLoading, isError, error } = useCampaigns()
  const send = useSendCampaign()
  const resume = useResumeCampaign()

  const subscribed = data?.subscribed ?? 0
  const busy = data?.data.some((c) => c.running) ?? false

  const set =
    (key: "subject" | "ctaLabel" | "ctaUrl") => (e: React.ChangeEvent<HTMLInputElement>) => {
      setDraft((d) => ({ ...d, [key]: e.target.value }))
      if (errors[key]) setErrors((x) => ({ ...x, [key]: undefined }))
    }

  const setContent = React.useCallback((content: JSONContent) => {
    setDraft((d) => ({ ...d, content }))
    setErrors((x) => (x.content ? { ...x, content: undefined } : x))
  }, [])

  // The server's schema, so a bad field is caught before the request.
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
      // The editor's own type is looser than the schema's; the server checks it.
      { ...draft, content: draft.content as NewsletterDoc, test },
      {
        onSuccess: (result) => {
          if (result.test) {
            toast.success(`Test sent to ${result.to}. Check that inbox.`)
          } else {
            toast.success(
              `Sending to ${result.recipients} ${result.recipients === 1 ? "person" : "people"}.`,
            )
            setDraft(EMPTY)
            setEditorKey((k) => k + 1)
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

  const shown = useDebounce(draft, 350)
  const preview = React.useMemo(
    () =>
      renderNewsletter({
        subject: shown.subject || "Your subject",
        content: shown.content as NewsletterDoc,
        ctaLabel: shown.ctaLabel || null,
        ctaUrl: /^https?:\/\/\S+\.\S+/.test(shown.ctaUrl) ? shown.ctaUrl : null,
        unsubscribeUrl: `${siteConfig.url}/unsubscribe?preview=1`,
      }).html,
    [shown],
  )

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        icon={Mail}
        title="Write an email"
        parent={{ label: "Newsletter", href: "/admin/newsletter" }}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_460px] xl:items-start">
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

          {/* Not a Field, which wires its label to a single input. */}
          <div className="flex flex-col gap-2">
            <Label>Message</Label>
            <RichEditor
              key={editorKey}
              initial={draft.content}
              onChange={setContent}
              invalid={Boolean(errors.content)}
              placeholder="Hey rider, the skull you've been waiting for just dropped..."
            />
            {errors.content ? (
              <span role="alert" className="text-magenta text-[12.5px] leading-[1.45]">
                {errors.content}
              </span>
            ) : (
              <span className="text-acid font-mono text-[11px] tracking-[0.1em]">
                Pictures: the toolbar button, or paste or drop them in. JPG, PNG, WebP or GIF, up to
                8 MB.
              </span>
            )}
          </div>

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
            <HeaderButton
              type="button"
              disabled={send.isPending}
              onClick={() => valid() && submit(true)}
            >
              Send a test to me
            </HeaderButton>
            <HeaderButton
              type="submit"
              variant="primary"
              disabled={send.isPending || busy || subscribed === 0}
            >
              Send to {subscribed} {subscribed === 1 ? "subscriber" : "subscribers"}
            </HeaderButton>
            {busy ? (
              <span className="text-dim text-[12.5px]">
                One is still sending; this waits for it.
              </span>
            ) : null}
          </div>

          <div className="text-dim flex flex-col gap-1.5 text-[12.5px] leading-[1.6]">
            <p>
              Goes to everyone subscribed, one email each with their own unsubscribe link. Send
              yourself a test first to see it in a real inbox.
            </p>
            <p>
              Sent through Brevo from no-reply@skelmet.in, or the shop&apos;s Gmail if Brevo fails,
              about 40 a minute. Brevo&apos;s free plan allows 300 emails a day and Gmail about 500;
              past both the email pauses here and Resume sends the rest the next day.
            </p>
          </div>
        </form>

        {/* Rendered by the same code that sends it; sandboxed so nothing in it runs. */}
        <div className="bg-void rounded-md border border-white/[0.09] p-4">
          <h2 className="text-bone mb-3 text-[15px] font-semibold">Preview</h2>
          <iframe
            title="Email preview"
            sandbox=""
            srcDoc={preview}
            className="h-[760px] w-full rounded-md border border-white/[0.06] bg-[#07060a]"
          />
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-bone text-[15px] font-semibold">Sent</h2>
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
            compact
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
      <HeaderButton disabled={resuming} onClick={onResume}>
        Resume
      </HeaderButton>
      {note ? (
        <span className="text-dim max-w-[340px] truncate text-[12px]" title={note}>
          {note}
        </span>
      ) : null}
    </span>
  )
}
