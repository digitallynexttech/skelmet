"use client"

import * as React from "react"
import { Check, Copy, Eye, EyeOff } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input, Label } from "@/components/ui/input"
import type {
  SecretState,
  SettingSource,
} from "@/features/settings/schemas/runtime-settings.schema"
import { cn } from "@/lib/utils"

/** A card on the settings screen. */
export function Panel({
  title,
  description,
  aside,
  children,
}: {
  title: string
  description?: React.ReactNode
  aside?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="rounded-card bg-carbon border border-white/[0.09] p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-[640px]">
          <h2 className="font-display text-bone text-[22px] leading-[1.08] uppercase">{title}</h2>
          {description ? (
            <div className="text-ash mt-2 text-[13.5px] leading-[1.6]">{description}</div>
          ) : null}
        </div>
        {aside}
      </div>
      {children}
    </section>
  )
}

/** Where a value in use comes from: saved here, the server's .env, or nowhere. */
export function SourceBadge({
  source,
  unreadable,
}: {
  source: SettingSource
  unreadable?: boolean
}) {
  if (unreadable) return <Badge variant="ember">Saved · cannot be read</Badge>
  if (source === "saved") return <Badge variant="violet">Saved here</Badge>
  if (source === "env") return <Badge variant="muted">From server .env</Badge>
  return <Badge variant="ember">Not set</Badge>
}

/** A labelled field, with the label tied to its input and room for a hint or an error. */
export function SettingField({
  id,
  label,
  badge,
  hint,
  error,
  children,
  className,
}: {
  id: string
  label: string
  badge?: React.ReactNode
  hint?: React.ReactNode
  error?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)}>
      <div className="flex min-h-7 flex-wrap items-center justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {badge}
      </div>
      {children}
      {error ? (
        <span id={`${id}-error`} role="alert" className="text-magenta text-[12.5px] leading-[1.45]">
          {error}
        </span>
      ) : hint ? (
        <span id={`${id}-hint`} className="text-dim text-[12.5px] leading-[1.45]">
          {hint}
        </span>
      ) : null}
    </div>
  )
}

/**
 * A secret is never filled in: the saved one stays on the server. The field
 * starts empty, says what is in place, and only what is typed into it is
 * sent - to replace that.
 */
export function SecretInput({
  id,
  value,
  onChange,
  state,
  disabled,
  invalid,
}: {
  id: string
  value: string
  onChange: (next: string) => void
  state: SecretState
  disabled?: boolean
  invalid?: boolean
}) {
  const [shown, setShown] = React.useState(false)
  const placeholder = state.set ? `Set${state.hint ? ` · ${state.hint}` : ""}` : "Not set"

  return (
    <div className="relative">
      <Input
        id={id}
        type={shown ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        // Stops the browser offering, or quietly filling in, the console's own login.
        autoComplete="new-password"
        data-1p-ignore
        data-lpignore="true"
        spellCheck={false}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? `${id}-error` : undefined}
        className="pr-12 font-mono"
      />
      <button
        type="button"
        onClick={() => setShown((v) => !v)}
        aria-label={shown ? "Hide what is typed" : "Show what is typed"}
        aria-pressed={shown}
        disabled={disabled}
        className="text-dim hover:text-bone absolute inset-y-0 right-0 flex w-12 items-center justify-center transition-colors disabled:opacity-40"
      >
        {shown ? (
          <EyeOff className="size-4" strokeWidth={1.9} />
        ) : (
          <Eye className="size-4" strokeWidth={1.9} />
        )}
      </button>
    </div>
  )
}

/** A value to paste somewhere else - a webhook URL - with a copy button. */
export function CopyLine({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = React.useState(false)

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-dim font-mono text-[10.5px] tracking-[0.16em] uppercase">{label}</span>
      <div className="bg-void flex min-w-0 items-center gap-2 rounded-md border border-white/[0.09] py-1.5 pr-1.5 pl-4">
        <code className="text-bone min-w-0 flex-1 truncate font-mono text-[13px]">{value}</code>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value)
              setCopied(true)
              window.setTimeout(() => setCopied(false), 1600)
            } catch {
              // No clipboard access (an http page): the value is on screen to select.
            }
          }}
        >
          {copied ? (
            <Check className="size-3.5" strokeWidth={2.2} />
          ) : (
            <Copy className="size-3.5" strokeWidth={1.9} />
          )}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  )
}

/** The first message zod gives for each field, keyed by the field's own name. */
export function fieldErrors(issues: Array<{ path: PropertyKey[]; message: string }>) {
  const out: Record<string, string> = {}
  for (const issue of issues) {
    const key = String(issue.path.at(-1) ?? "")
    out[key] ??= issue.message
  }
  return out
}

/** Said once under a form with secrets in it. */
export function SecretsNote() {
  return (
    <p className="text-dim text-[12.5px] leading-[1.5]">
      A secret is never shown again once saved. Leave it empty to keep the one in place, or type a
      new one to replace it.
    </p>
  )
}

/** A bulleted list of what a save will change, for its confirmation. */
export function ChangeList({ lines, children }: { lines: string[]; children?: React.ReactNode }) {
  return (
    <>
      <ul className="text-bone mb-3 list-disc space-y-1 pl-5">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      {children}
    </>
  )
}
