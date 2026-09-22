"use client"

import * as React from "react"
import { ArrowRight, Check } from "lucide-react"

import { Button } from "@/components/ui/button"
import { apiFetch } from "@/lib/api-fetch"
import { Field, Input, Textarea } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const TOPICS = [
  "My order",
  "Fitting help",
  "Return or refund",
  "Bulk / club order",
  "Custom colour",
  "Something else",
] as const

export function ContactForm() {
  const [topic, setTopic] = React.useState<string>(TOPICS[0])
  const [sent, setSent] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)

    setPending(true)
    setError(null)

    try {
      await apiFetch("/api/public/contact", {
        method: "POST",
        body: JSON.stringify({
          name: String(form.get("name") ?? ""),
          email: String(form.get("email") ?? ""),
          phone: String(form.get("phone") ?? ""),
          topic: String(form.get("topic") ?? ""),
          orderNumber: String(form.get("orderNumber") ?? ""),
          message: String(form.get("message") ?? ""),
          website: String(form.get("website") ?? ""),
        }),
      })
      setSent(true)
    } catch (err) {
      setPending(false)
      setError(
        err instanceof Error
          ? err.message
          : "That did not send. Try again, or email hello@skelmet.in.",
      )
    }
  }

  if (sent) {
    return (
      <div className="rounded-card border-acid/30 bg-carbon flex flex-col items-center border bg-[linear-gradient(160deg,rgb(212_255_61_/_0.07),transparent_56%)] p-10 text-center sm:p-14">
        <span className="bg-acid mb-6 flex size-14 items-center justify-center rounded-full">
          <Check className="text-void size-7" strokeWidth={3} />
        </span>
        <h2 className="font-display text-bone mb-3 text-[30px] leading-[1.04] uppercase sm:text-[36px]">
          Message sent
        </h2>
        <p className="text-ash max-w-[380px] text-[15px] leading-[1.6]">
          A human will read it and reply within a working day. If it&apos;s about an order in
          transit, WhatsApp is faster.
        </p>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-card bg-carbon relative border border-white/10 p-6 sm:p-8 xl:p-10"
    >
      <h2 className="font-display text-bone mb-7 text-[28px] leading-[1.04] uppercase sm:text-[34px]">
        Send us a message
      </h2>

      <div className="flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Your name">
            <Input name="name" required autoComplete="name" placeholder="Rohan Mehta" />
          </Field>
          <Field label="Email">
            <Input
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone (optional)">
            <Input name="phone" type="tel" autoComplete="tel" placeholder="+91" />
          </Field>
          <Field label="Order number (optional)">
            <Input name="orderNumber" placeholder="SKM-2026-XXXX" className="font-mono text-sm" />
          </Field>
        </div>

        <fieldset className="flex flex-col gap-2.5">
          <legend className="text-dim mb-1 font-mono text-[10.5px] tracking-[0.16em] uppercase">
            What&apos;s this about
          </legend>
          <div className="flex flex-wrap gap-2.5">
            {TOPICS.map((t) => {
              const selected = t === topic
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTopic(t)}
                  aria-pressed={selected}
                  className={cn(
                    "min-h-11 rounded-full border px-4.5 text-[13.5px] transition-colors",
                    selected
                      ? "border-blaze bg-blaze/12 text-bone font-medium"
                      : "text-ash border-white/[0.14] hover:border-white/30",
                  )}
                >
                  {t}
                </button>
              )
            })}
          </div>
          <input type="hidden" name="topic" value={topic} />
        </fieldset>

        {/* Honeypot. Positioned off-screen rather than display:none, which some
            bots skip. A real person never sees it, so anything in it is a bot. */}
        <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label htmlFor="website">Do not fill this in</label>
          <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
        </div>

        <Field label="Message">
          <Textarea
            name="message"
            required
            rows={6}
            placeholder="Tell us what's going on…"
            className="h-[150px]"
          />
        </Field>

        {error ? (
          <p role="alert" className="text-magenta text-[13.5px]">
            {error}
          </p>
        ) : null}

        <div className="flex flex-col gap-5 pt-1 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-dim max-w-[300px] text-[13px] leading-[1.5]">
            By sending this you agree we can email you back. That&apos;s all we use it for.
          </p>
          <Button type="submit" variant="primary" size="md" disabled={pending}>
            {pending ? "Sending…" : "Send it"}
            <ArrowRight className="size-4" strokeWidth={2.4} />
          </Button>
        </div>
      </div>
    </form>
  )
}
