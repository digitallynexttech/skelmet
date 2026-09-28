import * as React from "react"

import { cn } from "@/lib/utils"

// aria-invalid turns the border magenta, so a field in error reads as one
// even before its message is read.
const base =
  "w-full rounded-field border border-white/[0.14] bg-void px-4 text-[15px] text-bone outline-none transition-colors placeholder:text-dim focus:border-blaze focus:ring-[3px] focus:ring-blaze/[0.16] disabled:opacity-50 aria-[invalid=true]:border-magenta aria-[invalid=true]:focus:ring-magenta/[0.16]"

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>

export function Input({ className, ...props }: InputProps) {
  return <input className={cn(base, "h-[52px]", className)} {...props} />
}

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>

export function Textarea({ className, ...props }: TextareaProps) {
  return <textarea className={cn(base, "resize-none py-4 leading-relaxed", className)} {...props} />
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("text-dim font-mono text-[11.5px] tracking-[0.14em] uppercase", className)}
      {...props}
    />
  )
}

export function Field({
  label,
  hint,
  error,
  id,
  children,
  className,
}: {
  label: string
  hint?: React.ReactNode
  /** Replaces the hint while it is set. */
  error?: string
  id?: string
  children: React.ReactNode
  className?: string
}) {
  // The label is tied to its control and the message under it described by
  // it, so a screen reader announces "Email, edit text, Enter a valid email"
  // rather than an unnamed field. Wired here once rather than at 35 call
  // sites: the single control inside gets an id (unless it has one), the
  // message's id, and aria-invalid while there is an error.
  const auto = React.useId()
  const messageId = `${auto}-message`
  const control = React.isValidElement<Record<string, unknown>>(children) ? children : null
  const controlId = (control?.props.id as string | undefined) ?? `${auto}-control`
  const wired = control
    ? React.cloneElement(control, {
        id: controlId,
        "aria-describedby":
          [control.props["aria-describedby"], error || hint ? messageId : null]
            .filter(Boolean)
            .join(" ") || undefined,
        "aria-invalid": control.props["aria-invalid"] ?? (error ? true : undefined),
      })
    : children

  return (
    <div id={id} className={cn("flex flex-col gap-2", className)}>
      <Label htmlFor={control ? controlId : undefined}>{label}</Label>
      {wired}
      {error ? (
        <span id={messageId} role="alert" className="text-magenta text-[12.5px] leading-[1.45]">
          {error}
        </span>
      ) : hint ? (
        <span id={messageId} className="text-acid font-mono text-[11px] tracking-[0.1em]">
          {hint}
        </span>
      ) : null}
    </div>
  )
}
