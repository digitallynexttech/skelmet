"use client"

import { Search, X } from "lucide-react"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

/** The search box in a table's bar, with a button to clear it. */
export function TableSearch({
  value,
  onChange,
  placeholder,
  label,
  className,
}: {
  value: string
  onChange: (next: string) => void
  placeholder: string
  /** Accessible name: what is searched, in full. */
  label: string
  className?: string
}) {
  return (
    <div className={cn("relative min-w-0 flex-1 sm:max-w-[280px]", className)}>
      <Search
        className="text-dim pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
        strokeWidth={1.9}
      />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="h-9 pr-8 pl-9 text-[13px]"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear the search"
          className="text-dim hover:text-bone absolute top-1/2 right-2 flex size-6 -translate-y-1/2 items-center justify-center transition-colors"
        >
          <X className="size-3.5" strokeWidth={2.2} />
        </button>
      ) : null}
    </div>
  )
}
