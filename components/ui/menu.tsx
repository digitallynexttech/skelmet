"use client"

import * as React from "react"
import Link from "next/link"
import { Check, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * A button that opens a short list of actions: Export, More actions, the
 * column picker. The keyboard works as it does in a native menu - arrows,
 * Home and End move, Escape closes and puts focus back on the button.
 *
 * The panel hangs off the button, and is nudged sideways when that would put
 * any of it off the screen: on a phone the button can sit anywhere in a
 * wrapped row, and a panel past the edge would be cut off by the page.
 */

const MenuContext = React.createContext<(refocus?: boolean) => void>(() => {})

const ITEMS = ["menuitem", "menuitemcheckbox", "menuitemradio"]
  .map((role) => `[role=${role}]:not([disabled])`)
  .join(",")

export function Menu({
  label,
  button,
  buttonClassName,
  align = "end",
  onOpen,
  className,
  children,
}: {
  /** Accessible name of the menu, and of the button when it shows only an icon. */
  label: string
  button: React.ReactNode
  buttonClassName?: string
  /** Which edge of the button the panel lines up with. */
  align?: "start" | "end"
  /** Called as the menu opens, for a menu whose items depend on that moment. */
  onOpen?: () => void
  className?: string
  children: React.ReactNode
}) {
  const [open, setOpen] = React.useState(false)
  const wrap = React.useRef<HTMLDivElement>(null)
  const trigger = React.useRef<HTMLButtonElement>(null)
  const panel = React.useRef<HTMLDivElement>(null)
  const id = React.useId()

  const close = React.useCallback((refocus = true) => {
    setOpen(false)
    if (refocus) trigger.current?.focus()
  }, [])

  React.useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [open])

  // Into the screen, then focus, so arrow keys work straight away.
  React.useLayoutEffect(() => {
    const el = panel.current
    if (!open || !el) return
    el.style.translate = ""
    const r = el.getBoundingClientRect()
    const edge = 8
    const shift =
      r.left < edge
        ? edge - r.left
        : r.right > window.innerWidth - edge
          ? window.innerWidth - edge - r.right
          : 0
    if (shift) el.style.translate = `${shift}px 0`
    el.focus()
  }, [open])

  function show() {
    onOpen?.()
    setOpen(true)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        show()
      }
      return
    }
    const items = Array.from(panel.current?.querySelectorAll<HTMLElement>(ITEMS) ?? [])
    const at = items.indexOf(document.activeElement as HTMLElement)
    const go = (i: number) => {
      e.preventDefault()
      items[(i + items.length) % items.length]?.focus()
    }
    if (e.key === "Escape") {
      e.preventDefault()
      close()
    } else if (e.key === "Tab") {
      close(false)
    } else if (e.key === "ArrowDown") go(at + 1)
    else if (e.key === "ArrowUp") go(at < 0 ? items.length - 1 : at - 1)
    else if (e.key === "Home") go(0)
    else if (e.key === "End") go(items.length - 1)
  }

  return (
    <div ref={wrap} className={cn("relative", className)} onKeyDown={onKeyDown}>
      <button
        ref={trigger}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={label}
        onClick={() => (open ? setOpen(false) : show())}
        className={buttonClassName}
      >
        {button}
      </button>

      {open ? (
        <div
          ref={panel}
          id={id}
          role="menu"
          aria-label={label}
          tabIndex={-1}
          className={cn(
            "bg-carbon absolute top-[calc(100%+6px)] z-50 w-max max-w-[calc(100vw-16px)] min-w-[220px] rounded-sm border border-white/[0.14] p-1.5 shadow-[0_18px_40px_-12px_rgba(0,0,0,0.85)] outline-none",
            align === "end" ? "right-0" : "left-0",
          )}
        >
          <MenuContext.Provider value={close}>{children}</MenuContext.Provider>
        </div>
      ) : null}
    </div>
  )
}

const itemClass =
  "flex w-full items-center gap-2.5 rounded-sm px-3 py-2 text-left text-[13.5px] text-ash outline-none transition-colors hover:bg-white/[0.07] hover:text-bone focus-visible:bg-white/[0.07] focus-visible:text-bone disabled:pointer-events-none disabled:opacity-40"

/** An action. The menu closes once it has run. */
export function MenuItem({
  icon: Icon,
  onSelect,
  disabled,
  hint,
  children,
}: {
  icon?: LucideIcon
  onSelect: () => void
  disabled?: boolean
  /** Shown muted on the right. */
  hint?: React.ReactNode
  children: React.ReactNode
}) {
  const close = React.useContext(MenuContext)
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={() => {
        close()
        onSelect()
      }}
      className={itemClass}
    >
      {Icon ? <Icon className="size-4 shrink-0" strokeWidth={1.9} /> : null}
      <span className="flex-1">{children}</span>
      {hint != null ? <span className="text-dim font-mono text-[11.5px]">{hint}</span> : null}
    </button>
  )
}

/** Another page. */
export function MenuLink({
  icon: Icon,
  href,
  children,
}: {
  icon?: LucideIcon
  href: string
  children: React.ReactNode
}) {
  const close = React.useContext(MenuContext)
  return (
    <Link href={href} role="menuitem" onClick={() => close(false)} className={itemClass}>
      {Icon ? <Icon className="size-4 shrink-0" strokeWidth={1.9} /> : null}
      <span className="flex-1">{children}</span>
    </Link>
  )
}

/** One of a set, as in a select: ticked while it is the current one. */
export function MenuOption({
  checked,
  onSelect,
  hint,
  children,
}: {
  checked: boolean
  onSelect: () => void
  /** Shown muted on the right, e.g. a count. */
  hint?: React.ReactNode
  children: React.ReactNode
}) {
  const close = React.useContext(MenuContext)
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={checked}
      onClick={() => {
        close()
        onSelect()
      }}
      className={cn(itemClass, checked && "text-bone font-semibold")}
    >
      <Check
        className={cn("text-blaze size-3.5 shrink-0", !checked && "opacity-0")}
        strokeWidth={2.6}
      />
      <span className="flex-1">{children}</span>
      {hint != null ? (
        <span className="text-dim font-mono text-[11.5px] font-normal">{hint}</span>
      ) : null}
    </button>
  )
}

/** A setting that stays open on change, so several can be flipped in a row. */
export function MenuCheckbox({
  checked,
  onChange,
  disabled,
  children,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="menuitemcheckbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={itemClass}
    >
      <span
        className={cn(
          "flex size-4 shrink-0 items-center justify-center rounded-sm border transition-colors",
          checked ? "border-blaze bg-blaze text-void" : "border-white/25",
        )}
      >
        {checked ? <Check className="size-3" strokeWidth={3} /> : null}
      </span>
      <span className="flex-1">{children}</span>
    </button>
  )
}

/** A heading over a group of items, or a line saying what they act on. */
export function MenuLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-dim px-3 pt-1.5 pb-1 font-mono text-[10.5px] tracking-[0.14em] uppercase">
      {children}
    </div>
  )
}

export function MenuSeparator() {
  return <div role="separator" className="my-1.5 h-px bg-white/[0.08]" />
}
