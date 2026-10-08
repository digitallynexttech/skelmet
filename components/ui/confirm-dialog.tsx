"use client"

import * as React from "react"

import { HeaderButton } from "@/components/ui/header-button"
import { cn } from "@/lib/utils"

/** A yes/no dialog on native <dialog>: the browser handles top layer, backdrop and focus trap. */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "primary",
  pending = false,
  onConfirm,
  onClose,
}: {
  open: boolean
  title: string
  body?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** "danger" for anything destructive. */
  tone?: "primary" | "danger"
  pending?: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  const ref = React.useRef<HTMLDialogElement>(null)
  // Unique: the sidebar keeps one of these on every admin page.
  const titleId = React.useId()

  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) el.showModal()
    if (!open && el.open) el.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        // Escape fires `cancel`, not a click: route it to onClose so React's state agrees.
        e.preventDefault()
        if (!pending) onClose()
      }}
      onClick={(e) => {
        // A click on the backdrop lands on the dialog element itself.
        if (e.target === ref.current && !pending) onClose()
      }}
      aria-labelledby={titleId}
      className={cn(
        "bg-carbon text-bone m-auto w-[min(92vw,420px)] rounded-md border border-white/[0.14] p-0",
        "backdrop:bg-black/70 backdrop:backdrop-blur-[2px]",
      )}
    >
      <div className="p-6">
        <h2 id={titleId} className="mb-2 text-[17px] font-semibold">
          {title}
        </h2>
        {body ? <div className="text-ash text-[14px] leading-[1.6]">{body}</div> : null}

        <div className="mt-6 flex justify-end gap-2.5">
          <HeaderButton onClick={onClose} disabled={pending}>
            {cancelLabel}
          </HeaderButton>
          <HeaderButton
            variant={tone === "danger" ? "danger" : "primary"}
            onClick={onConfirm}
            disabled={pending}
          >
            {pending ? "Working…" : confirmLabel}
          </HeaderButton>
        </div>
      </div>
    </dialog>
  )
}
