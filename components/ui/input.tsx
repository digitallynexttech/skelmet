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
      className={cn("text-dim font-mono text-[10.5px] tracking-[0.16em] uppercase", className)}
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
  return (
    <div id={id} className={cn("flex flex-col gap-2", className)}>
      <Label>{label}</Label>
      {children}
      {error ? (
        <span role="alert" className="text-magenta text-[12.5px] leading-[1.45]">
          {error}
        </span>
      ) : hint ? (
        <span className="text-acid font-mono text-[10.5px] tracking-[0.1em]">{hint}</span>
      ) : null}
    </div>
  )
}
