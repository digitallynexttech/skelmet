"use client"

import * as React from "react"

import { ConfirmDialog } from "@/components/ui/confirm-dialog"

/** For actions hard to take back, e.g. a refund or a courier booking. */
export type Confirmation = {
  title: string
  body: React.ReactNode
  confirmLabel: string
  tone?: "primary" | "danger"
  /** Call `done` once settled; it closes the dialog. */
  run: (done: () => void) => void
}

export type Ask = (confirmation: Confirmation) => void

/** One dialog per screen: render `dialog` once, pass `ask` around. */
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
