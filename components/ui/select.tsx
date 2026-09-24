"use client"

import * as React from "react"
import { Check, ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * A select that obeys the palette.
 *
 * `<select>` draws its option list with the operating system, not the page:
 * on Windows that is a white panel with a blue highlight sitting in the middle
 * of a black console. Nothing in CSS reaches inside it, so the list is drawn
 * here instead.
 *
 * What the native control gives away by being replaced — keyboard support and
 * the accessibility tree — is put back explicitly: roles, arrow keys, Home and
 * End, Enter and Escape, and focus returned to the trigger on close.
 */

export type SelectOption<T extends string> = {
  value: T
  label: string
  /** Shown muted on the right, e.g. a count. */
  hint?: React.ReactNode
}

export function Select<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
}: {
  value: T
  options: SelectOption<T>[]
  onChange: (next: T) => void
  /** Accessible name for the trigger. */
  label: string
  className?: string
}) {
  const [open, setOpen] = React.useState(false)
  const [focused, setFocused] = React.useState(0)
  const wrap = React.useRef<HTMLDivElement>(null)
  const trigger = React.useRef<HTMLButtonElement>(null)
  const list = React.useRef<HTMLDivElement>(null)
  const listId = React.useId()

  const selected = options.find((o) => o.value === value) ?? options[0]

  React.useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [open])

  // Keep the focused row in view when arrowing past the panel's edge.
  React.useEffect(() => {
    if (!open) return
    list.current?.querySelectorAll("[role=option]")[focused]?.scrollIntoView({ block: "nearest" })
  }, [open, focused])

  /**
   * Opening puts the cursor on the current choice rather than the top. Done
   * here rather than in an effect on `open`: setting state from an effect
   * costs a second render every time the panel appears.
   */
  function show() {
    setFocused(Math.max(0, options.findIndex((o) => o.value === value)))
    setOpen(true)
  }

  function choose(next: T) {
    onChange(next)
    setOpen(false)
    trigger.current?.focus()
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        show()
      }
      return
    }
    if (e.key === "Escape") {
      e.preventDefault()
      setOpen(false)
      trigger.current?.focus()
    } else if (e.key === "ArrowDown") {
      e.preventDefault()
      setFocused((i) => Math.min(options.length - 1, i + 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setFocused((i) => Math.max(0, i - 1))
    } else if (e.key === "Home") {
      e.preventDefault()
      setFocused(0)
    } else if (e.key === "End") {
      e.preventDefault()
      setFocused(options.length - 1)
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      const pick = options[focused]
      if (pick) choose(pick.value)
    }
  }

  return (
    <div ref={wrap} className={cn("relative", className)} onKeyDown={onKeyDown}>
      <button
        ref={trigger}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-haspopup="listbox"
        aria-label={label}
        onClick={() => (open ? setOpen(false) : show())}
        className={cn(
          "rounded-field bg-void text-bone flex h-[52px] w-full items-center justify-between gap-3 border border-white/[0.14] px-4 text-[14px] transition-colors",
          "focus:border-blaze focus:ring-blaze/[0.16] outline-none focus:ring-[3px]",
          open && "border-blaze",
        )}
      >
        <span className="truncate">{selected?.label}</span>
        <span className="flex shrink-0 items-center gap-2">
          {selected?.hint != null ? (
            <span className="text-dim font-mono text-[12px]">{selected.hint}</span>
          ) : null}
          <ChevronDown
            className={cn("text-dim size-4 transition-transform", open && "rotate-180")}
            strokeWidth={2}
          />
        </span>
      </button>

      {open ? (
        <div
          ref={list}
          id={listId}
          role="listbox"
          aria-label={label}
          tabIndex={-1}
          className="rounded-md bg-carbon absolute top-[calc(100%+6px)] right-0 left-0 z-50 max-h-[min(420px,60vh)] overflow-y-auto border border-white/[0.14] p-1.5 shadow-[0_18px_40px_-12px_rgba(0,0,0,0.85)]"
        >
          {options.map((o, i) => {
            const isSelected = o.value === value
            return (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => choose(o.value)}
                onMouseEnter={() => setFocused(i)}
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded px-3 py-2.5 text-left text-[13.5px] transition-colors",
                  i === focused ? "bg-white/[0.07]" : "bg-transparent",
                  isSelected ? "text-bone font-semibold" : "text-ash",
                )}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Check
                    className={cn("text-blaze size-3.5 shrink-0", !isSelected && "opacity-0")}
                    strokeWidth={2.6}
                  />
                  <span className="truncate">{o.label}</span>
                </span>
                {o.hint != null ? (
                  <span className="text-dim shrink-0 font-mono text-[12px]">{o.hint}</span>
                ) : null}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
