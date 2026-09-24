"use client"

import * as React from "react"
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * A date field that does not depend on the browser's own.
 *
 * `<input type="date">` renders a different control in every browser and shows
 * its own locale's order — a dd-mm-yyyy placeholder in one, mm/dd/yyyy in the
 * next — which is wrong for a console that has already chosen a palette and a
 * date format. This draws the calendar instead, so it looks the same
 * everywhere and reads the way the rest of the admin does.
 *
 * The value is mirrored into a hidden input as `YYYY-MM-DD`, so a plain
 * FormData submit still works.
 */

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"]
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

/** Local Y-M-D. Never toISOString: that converts to UTC and can shift a day. */
function toKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0")
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate())
}

function parseKey(key: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key)
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return Number.isNaN(d.getTime()) ? null : d
}

function pretty(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
}

/** Monday-first offset for the 1st of the month. */
function leadingBlanks(year: number, month: number): number {
  return (new Date(year, month, 1).getDay() + 6) % 7
}

export function DateField({
  name,
  value,
  onChange,
  placeholder = "Pick a date",
  /** Days before this cannot be chosen. Defaults to today. */
  min,
  className,
}: {
  name: string
  value: string
  onChange: (next: string) => void
  placeholder?: string
  min?: Date
  className?: string
}) {
  const [open, setOpen] = React.useState(false)
  const wrap = React.useRef<HTMLDivElement>(null)

  const selected = parseKey(value)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const floor = min ?? today

  const [view, setView] = React.useState<Date>(() => selected ?? today)

  // Both an outside click and Escape close it. Without them the panel sits
  // over the rest of the form with no way back.
  React.useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  const year = view.getFullYear()
  const month = view.getMonth()
  const days = new Date(year, month + 1, 0).getDate()
  const blanks = leadingBlanks(year, month)
  const todayKey = toKey(today)

  return (
    <div ref={wrap} className={cn("relative", className)}>
      <input type="hidden" name={name} value={value} />

      <button
        type="button"
        onClick={() => {
          setView(selected ?? today)
          setOpen((v) => !v)
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          "rounded-field bg-void text-bone flex h-[52px] w-full items-center justify-between border border-white/[0.14] px-4 text-[15px] transition-colors",
          "focus:border-blaze focus:ring-blaze/[0.16] outline-none focus:ring-[3px]",
          open && "border-blaze",
        )}
      >
        <span className={cn(!selected && "text-dim")}>
          {selected ? pretty(selected) : placeholder}
        </span>
        <CalendarDays className="text-dim size-4 shrink-0" strokeWidth={1.9} />
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Choose a date"
          className="rounded-md bg-carbon absolute top-[calc(100%+6px)] left-0 z-50 w-[292px] border border-white/[0.14] p-3 shadow-[0_18px_40px_-12px_rgba(0,0,0,0.85)]"
        >
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setView(new Date(year, month - 1, 1))}
              aria-label="Previous month"
              className="text-ash hover:text-bone flex size-8 items-center justify-center rounded-md border border-white/[0.12] transition-colors hover:border-white/25"
            >
              <ChevronLeft className="size-4" strokeWidth={2} />
            </button>

            <span className="text-bone font-mono text-[12.5px] tracking-[0.08em] uppercase">
              {MONTHS[month]} {year}
            </span>

            <button
              type="button"
              onClick={() => setView(new Date(year, month + 1, 1))}
              aria-label="Next month"
              className="text-ash hover:text-bone flex size-8 items-center justify-center rounded-md border border-white/[0.12] transition-colors hover:border-white/25"
            >
              <ChevronRight className="size-4" strokeWidth={2} />
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-1">
            {WEEKDAYS.map((d, i) => (
              <span
                key={i}
                className="text-dim grid h-7 place-items-center font-mono text-[10px] tracking-[0.1em]"
              >
                {d}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: blanks }, (_, i) => (
              <span key={"blank" + i} />
            ))}
            {Array.from({ length: days }, (_, i) => {
              const day = i + 1
              const d = new Date(year, month, day)
              const key = toKey(d)
              const isSelected = key === value
              const isToday = key === todayKey
              const disabled = d < floor
              return (
                <button
                  key={day}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    onChange(key)
                    setOpen(false)
                  }}
                  aria-current={isToday ? "date" : undefined}
                  className={cn(
                    "grid h-8 place-items-center rounded-md font-mono text-[12.5px] transition-colors",
                    disabled && "text-dim/40 cursor-not-allowed",
                    !disabled && !isSelected && "text-ash hover:text-bone hover:bg-white/[0.07]",
                    isSelected && "bg-blaze text-void font-bold",
                    !isSelected && isToday && "text-ember",
                  )}
                >
                  {day}
                </button>
              )
            })}
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-white/[0.08] pt-3">
            <button
              type="button"
              onClick={() => {
                onChange("")
                setOpen(false)
              }}
              className="text-dim hover:text-bone font-mono text-[11px] tracking-[0.1em] uppercase transition-colors"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-ash hover:text-bone font-mono text-[11px] tracking-[0.1em] uppercase transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
