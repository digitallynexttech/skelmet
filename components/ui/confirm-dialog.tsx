"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * A yes/no dialog for an action worth pausing on.
 *
 * Built on <dialog>, so the browser handles the top layer, the backdrop and
 * the focus trap rather than a div pretending to be modal. showModal() also
 * gives Escape-to-close for free — but it fires a `cancel` event rather than
 * a click, so that is wired to onClose or Escape would dismiss the dialog
 * while React still believed it was open.
 */
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
        // Escape closes it; let the parent know so its state agrees.
        e.preventDefault()
        if (!pending) onClose()
      }}
      onClick={(e) => {
        // A click on the backdrop lands on the dialog element itself.
        if (e.target === ref.current && !pending) onClose()
      }}
      aria-labelledby="confirm-title"
      className={cn(
        "rounded-md bg-carbon text-bone m-auto w-[min(92vw,420px)] border border-white/[0.14] p-0",
        "backdrop:bg-black/70 backdrop:backdrop-blur-[2px]",
      )}
    >
      <div className="p-6">
        <h2 id="confirm-title" className="font-display mb-2 text-[22px] uppercase">
          {title}
        </h2>
        {body ? <div className="text-ash text-[14px] leading-[1.6]">{body}</div> : null}

        <div className="mt-6 flex justify-end gap-2.5">
          <Button type="button" variant="ghost" size="md" onClick={onClose} disabled={pending}>
            {cancelLabel}
          </Button>
          {/* There is no danger variant in the button set, so a destructive
              confirm is a ghost button carrying the magenta the rest of the
              app already uses for failure. */}
          <Button
            type="button"
            variant={tone === "danger" ? "ghost" : "primary"}
            size="md"
            onClick={onConfirm}
            disabled={pending}
            className={cn(
              tone === "danger" &&
                "border-magenta/45 text-magenta hover:border-magenta hover:bg-magenta/[0.08]",
            )}
          >
            {pending ? "Working…" : confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  )
}
