import * as React from "react"

import { cn } from "@/lib/utils"

const base =
  "w-full rounded-field border border-white/[0.14] bg-void px-4 text-[15px] text-bone outline-none transition-colors placeholder:text-dim focus:border-blaze focus:ring-[3px] focus:ring-blaze/[0.16] disabled:opacity-50"

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
      className={cn("font-mono text-[10.5px] tracking-[0.16em] text-dim uppercase", className)}
      {...props}
    />
  )
}

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string
  hint?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Label>{label}</Label>
      {children}
      {hint ? <span className="font-mono text-[10.5px] tracking-[0.1em] text-acid">{hint}</span> : null}
    </div>
  )
}
