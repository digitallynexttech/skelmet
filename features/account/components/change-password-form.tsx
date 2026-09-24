"use client"

import * as React from "react"
import { signOut } from "next-auth/react"
import { AlertTriangle, ArrowRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Field, Input } from "@/components/ui/input"
import { ApiFetchError, apiFetch } from "@/lib/api-fetch"

export function ChangePasswordForm({ next = "/admin" }: { next?: string }) {
  const [error, setError] = React.useState<string | null>(null)
  const [pending, setPending] = React.useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setPending(true)

    const form = new FormData(event.currentTarget)
    try {
      await apiFetch<{ ok: true }>("/api/me/password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword: String(form.get("currentPassword") ?? ""),
          newPassword: String(form.get("newPassword") ?? ""),
          confirmPassword: String(form.get("confirmPassword") ?? ""),
        }),
      })

      // mustChangePassword rides the JWT, so the flag stays true in the token
      // until a new one is minted - and `session.update()` needs a
      // SessionProvider this app does not mount. Signing out and back in is
      // the reissue, and it is the honest flow anyway: the password they just
      // replaced is the one their current session was opened with.
      await signOut({ redirectTo: `/login?next=${encodeURIComponent(next)}` })
    } catch (err) {
      setError(err instanceof ApiFetchError ? err.message : "That didn't work. Try again.")
      setPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <Field label="Current password">
        <Input name="currentPassword" type="password" required autoComplete="current-password" />
      </Field>
      <Field label="New password">
        <Input
          name="newPassword"
          type="password"
          required
          minLength={10}
          autoComplete="new-password"
        />
      </Field>
      <Field label="New password again">
        <Input name="confirmPassword" type="password" required autoComplete="new-password" />
      </Field>

      {error ? (
        <div className="border-magenta/35 bg-magenta/[0.06] flex items-start gap-2.5 rounded-xl border p-4">
          <AlertTriangle className="text-magenta mt-0.5 size-4 shrink-0" strokeWidth={1.9} />
          <p className="text-bone text-[13.5px] leading-[1.5]">{error}</p>
        </div>
      ) : null}

      <Button type="submit" variant="primary" size="lg" full disabled={pending}>
        {pending ? "Saving…" : "Set new password"}
        <ArrowRight className="size-4" strokeWidth={2.4} />
      </Button>
    </form>
  )
}
