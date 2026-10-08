"use client"

import * as React from "react"
import { Check } from "lucide-react"

import { Button } from "@/components/ui/button"
import { siteConfig } from "@/lib/config/site"
import { apiFetch, ApiFetchError } from "@/lib/api-fetch"

/** A button, not on page load: mail scanners and link previews open every link in an email. */
export function UnsubscribeButton({ token }: { token: string }) {
  const [state, setState] = React.useState<"idle" | "pending" | "done">("idle")
  const [error, setError] = React.useState<string | null>(null)

  async function leave() {
    setState("pending")
    setError(null)
    try {
      await apiFetch(`/api/public/newsletter/unsubscribe?token=${encodeURIComponent(token)}`, {
        method: "POST",
      })
      setState("done")
    } catch (err) {
      setState("idle")
      setError(
        err instanceof ApiFetchError && err.status < 500
          ? err.message
          : `That did not go through. Try again, or email ${siteConfig.supportEmail}.`,
      )
    }
  }

  if (state === "done") {
    return (
      <p role="status" className="text-bone flex items-center gap-3 text-[15px] leading-[1.6]">
        <span className="bg-acid flex size-8 shrink-0 items-center justify-center rounded-full">
          <Check className="text-void size-4" strokeWidth={3} />
        </span>
        Done. You&apos;re off the list, and we won&apos;t email you about drops again.
      </p>
    )
  }

  return (
    <div>
      <Button variant="primary" size="md" disabled={state === "pending"} onClick={leave}>
        {state === "pending" ? "Unsubscribing…" : "Unsubscribe"}
      </Button>
      {error ? (
        <p role="alert" className="text-magenta mt-3 text-[13.5px]">
          {error}
        </p>
      ) : null}
    </div>
  )
}
