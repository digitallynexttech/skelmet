"use client"

import * as React from "react"
import { Check } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { siteConfig } from "@/config/site"
import { pixelLead } from "@/features/visitors/lib/meta-pixel"
import { apiFetch, ApiFetchError } from "@/lib/api-fetch"

/**
 * "Notify me" on the home page: joins the drop list, which staff see and email
 * under Newsletter in the console.
 *
 * It used to go through the contact endpoint and land in the inquiry inbox as
 * a message, where an address was a row to resolve rather than someone to
 * email - with no unsubscribe, and nothing to send from.
 */
export function DropListForm() {
  const [state, setState] = React.useState<"idle" | "pending" | "done">("idle")
  const [error, setError] = React.useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setState("pending")
    setError(null)

    try {
      await apiFetch("/api/public/newsletter", {
        method: "POST",
        body: JSON.stringify({
          email: String(form.get("email") ?? ""),
          website: String(form.get("website") ?? ""),
        }),
      })
      setState("done")
      pixelLead("Next drop list")
    } catch (err) {
      setState("idle")
      setError(
        err instanceof ApiFetchError && err.status < 500
          ? err.status === 422
            ? "That email doesn't look right."
            : err.message
          : `That did not go through. Try again, or email ${siteConfig.supportEmail}.`,
      )
    }
  }

  if (state === "done") {
    return (
      <p
        role="status"
        className="text-bone flex max-w-[460px] items-center gap-3 text-[15px] leading-[1.6]"
      >
        <span className="bg-violet flex size-8 shrink-0 items-center justify-center rounded-full">
          <Check className="text-void size-4" strokeWidth={3} />
        </span>
        You&apos;re on the list. We&apos;ll email you when the next drop lands.
      </p>
    )
  }

  return (
    // Hidden from Microsoft Clarity's recordings: an email address.
    <form data-clarity-mask="true" onSubmit={handleSubmit} className="relative max-w-[460px]">
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <Input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          aria-label="Email address"
          className="h-[54px] rounded-full"
        />
        <Button type="submit" variant="violet" size="md" disabled={state === "pending"}>
          {state === "pending" ? "Adding…" : "Notify me"}
        </Button>
      </div>

      {/* Honeypot, as on the contact form: off-screen, never seen by a person. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="drop-list-website">Do not fill this in</label>
        <input id="drop-list-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {error ? (
        <p role="alert" className="text-magenta mt-3 text-[13.5px]">
          {error}
        </p>
      ) : null}
    </form>
  )
}
