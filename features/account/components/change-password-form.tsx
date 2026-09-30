"use client"

import * as React from "react"
import { signIn, signOut } from "next-auth/react"
import { AlertTriangle, ArrowRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Field, Input } from "@/components/ui/input"
import { safeNextPath } from "@/features/account/lib/safe-next"
import { ApiFetchError, apiFetch } from "@/lib/api-fetch"

export function ChangePasswordForm({ next = "/admin", email }: { next?: string; email: string }) {
  const [error, setError] = React.useState<string | null>(null)
  // Under each box, what the server said is wrong with it.
  const [fields, setFields] = React.useState<Record<string, string>>({})
  const [pending, setPending] = React.useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setFields({})
    setPending(true)

    const form = new FormData(event.currentTarget)
    const newPassword = String(form.get("newPassword") ?? "")
    try {
      await apiFetch<{ ok: true }>("/api/me/password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword: String(form.get("currentPassword") ?? ""),
          newPassword,
          confirmPassword: String(form.get("confirmPassword") ?? ""),
        }),
      })
    } catch (err) {
      if (err instanceof ApiFetchError) setFields(err.fieldErrors)
      setError(
        err instanceof ApiFetchError
          ? err.message
          : "The password was not changed - the connection may have dropped. Try again.",
      )
      setPending(false)
      return
    }

    // The change ended every session opened with the old password, this one
    // included. Signing straight back in with the new one issues a fresh
    // session - with the flag cleared - so they carry on where they were.
    const destination = safeNextPath(next)
    const again = await signIn("credentials", {
      email,
      password: newPassword,
      redirect: false,
    }).catch(() => null)

    if (again && !again.error) {
      window.location.assign(destination)
      return
    }

    // Could not sign back in (a sign-in limit, say): the password is changed
    // either way, so sign out cleanly and let them use it.
    await signOut({ redirectTo: `/login?next=${encodeURIComponent(destination)}` })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <Field label="Current password" error={fields.currentPassword}>
        <Input name="currentPassword" type="password" required autoComplete="current-password" />
      </Field>
      <Field label="New password" hint="10 characters at least" error={fields.newPassword}>
        <Input
          name="newPassword"
          type="password"
          required
          minLength={10}
          autoComplete="new-password"
        />
      </Field>
      <Field label="New password again" error={fields.confirmPassword}>
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
