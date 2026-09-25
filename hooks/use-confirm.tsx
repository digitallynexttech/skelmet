"use client"

import * as React from "react"

import { ConfirmDialog } from "@/components/ui/confirm-dialog"

/**
 * A question put before an action that is hard to take back - a refund, a
 * courier booking, new payment keys. One click could otherwise do it by
 * mistake.
 */
export type Confirmation = {
  title: string
  body: React.ReactNode
  confirmLabel: string
  tone?: "primary" | "danger"
  /** Runs the action and calls `done` once it has settled, which closes the dialog. */
  run: (done: () => void) => void
}

export type Ask = (confirmation: Confirmation) => void

/**
 * One dialog for a screen, asked by whichever action wants confirming.
 * Render `dialog` once; pass `ask` to anything that needs it.
 */
export function useConfirm(): { ask: Ask; dialog: React.ReactNode } {
  const [confirmation, setConfirmation] = React.useState<Confirmation | null>(null)
  const [pending, setPending] = React.useState(false)

  const dialog = (
    <ConfirmDialog
      open={confirmation !== null}
      title={confirmation?.title ?? ""}
      body={confirmation?.body}
      confirmLabel={confirmation?.confirmLabel}
      tone={confirmation?.tone}
      pending={pending}
      onClose={() => setConfirmation(null)}
      onConfirm={() => {
        if (!confirmation) return
        setPending(true)
        confirmation.run(() => {
          setPending(false)
          setConfirmation(null)
        })
      }}
    />
  )

  return { ask: setConfirmation, dialog }
}
