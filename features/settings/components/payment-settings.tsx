"use client"

import * as React from "react"
import { CheckCircle2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  ChangeList,
  CopyLine,
  Panel,
  SecretInput,
  SecretsNote,
  SettingField,
  SourceBadge,
  fieldErrors,
} from "@/features/settings/components/settings-parts"
import { useRuntimeSettingsMutations } from "@/features/settings/hooks/use-runtime-settings"
import {
  KEY_PREFIX,
  PAYMENT_MODES,
  paymentSettingsSchema,
  type KeySetView,
  type PaymentMode,
  type RuntimeSettingsView,
} from "@/features/settings/schemas/runtime-settings.schema"
import type { Ask } from "@/hooks/use-confirm"
import { cn } from "@/lib/utils"

type Payment = RuntimeSettingsView["payment"]

const ACCOUNT: Record<PaymentMode, { title: string; blurb: string }> = {
  test: { title: "Test", blurb: "No real money. Only Razorpay's test cards work." },
  live: { title: "Live", blurb: "Real money, paid out to the shop's bank." },
}

/** Which Razorpay account checkout takes payments on. */
function ModeSwitch({ payment, canWrite, ask }: { payment: Payment; canWrite: boolean; ask: Ask }) {
  const { savePayment } = useRuntimeSettingsMutations()

  const choose = (mode: PaymentMode) => {
    if (mode === payment.mode) return
    const run = (done: () => void) => savePayment.mutate({ mode }, { onSettled: done })
    ask(
      mode === "live"
        ? {
            title: "Switch to live payments?",
            body: (
              <>
                From the next checkout, every payment is real money taken on the live Razorpay
                account (<span className="text-bone font-mono">{payment.live.keyId.value}</span>).
                Payments already taken in test mode stay on the test account, and still refund from
                it. Check the live webhook is set up in Razorpay first.
              </>
            ),
            confirmLabel: "Go live",
            run,
          }
        : {
            title: "Switch back to test payments?",
            body: "From the next checkout no real money is taken: customers can only pay with Razorpay's test cards, and nothing reaches the bank. Only for trying the shop out.",
            confirmLabel: "Switch to test",
            tone: "danger",
            run,
          },
    )
  }

  return (
    <div
      role="radiogroup"
      aria-label="Razorpay account checkout takes payments on"
      className="grid gap-3 sm:grid-cols-2"
    >
      {PAYMENT_MODES.map((mode) => {
        const keys = payment[mode]
        const on = payment.mode === mode
        const blocked = !on && !keys.ready
        return (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={!canWrite || blocked || savePayment.isPending}
            onClick={() => choose(mode)}
            className={cn(
              "rounded-tile flex min-w-0 flex-col items-start gap-2 border p-4 text-left transition-colors disabled:cursor-not-allowed",
              on
                ? mode === "live"
                  ? "border-acid/60 bg-acid/[0.06]"
                  : "border-violet/60 bg-violet/[0.08]"
                : "border-white/[0.09] enabled:hover:border-white/25 disabled:opacity-60",
            )}
          >
            <span className="flex w-full flex-wrap items-center justify-between gap-2">
              <span className="text-bone text-[16px] font-semibold">{ACCOUNT[mode].title}</span>
              {on ? (
                <Badge variant={mode === "live" ? "acid" : "violet"}>Taking payments</Badge>
              ) : null}
            </span>
            <span className="text-ash text-[13px]">{ACCOUNT[mode].blurb}</span>
            <span className="text-dim max-w-full truncate font-mono text-[12px]">
              {keys.keyId.value ?? "No keys yet"}
            </span>
            {blocked ? (
              <span className="text-ember text-[12.5px]">Add the {mode} keys below first</span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

/** One account's key id, key secret and webhook secret. */
function KeySetForm({
  mode,
  keys,
  active,
  canWrite,
  ask,
}: {
  mode: PaymentMode
  keys: KeySetView
  active: boolean
  canWrite: boolean
  ask: Ask
}) {
  const { savePayment, testPayment } = useRuntimeSettingsMutations()
  const savedId = keys.keyId.value ?? ""
  const [keyId, setKeyId] = React.useState(savedId)
  const [keySecret, setKeySecret] = React.useState("")
  const [webhookSecret, setWebhookSecret] = React.useState("")
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [accepted, setAccepted] = React.useState(false)

  const idChanged = keyId.trim() !== savedId
  const dirty = idChanged || keySecret.trim() !== "" || webhookSecret.trim() !== ""
  const anythingSaved =
    keys.keyId.source === "saved" ||
    keys.webhookSecret.source === "saved" ||
    keys.keySecret.unreadable ||
    keys.webhookSecret.unreadable
  const id = (field: string) => `${mode}-${field}`

  function submit(e: React.FormEvent) {
    e.preventDefault()
    // Only what was changed is sent: an untouched field is left as it is.
    const input: { keyId?: string; keySecret?: string; webhookSecret?: string } = {}
    if (idChanged) input.keyId = keyId.trim()
    if (keySecret.trim()) input.keySecret = keySecret.trim()
    if (webhookSecret.trim()) input.webhookSecret = webhookSecret.trim()
    // A secret is saved with its id. When the id shown is .env's, a new
    // secret for it saves the two together.
    if (input.keySecret && !idChanged && keys.keyId.source !== "saved" && keyId.trim()) {
      input.keyId = keyId.trim()
    }

    const parsed = paymentSettingsSchema.safeParse({ [mode]: input })
    const next = parsed.success ? {} : fieldErrors(parsed.error.issues)
    if (input.keyId && !input.keySecret) {
      next.keySecret ??= "Enter the secret that goes with this key id"
    }
    if (input.keySecret && !input.keyId && !savedId) {
      next.keyId ??= "Enter the key id that goes with this secret"
    }
    setErrors(next)
    if (Object.keys(next).length > 0) return

    const lines = [
      ...(idChanged
        ? [
            input.keyId
              ? `Key id: ${input.keyId}`
              : "Key id and secret removed - the ones in the server's .env are used, if it has any",
          ]
        : []),
      ...(input.keySecret ? ["Key secret replaced"] : []),
      ...(input.webhookSecret ? ["Webhook secret replaced"] : []),
    ]

    ask({
      title: `Save the ${mode} keys?`,
      body: (
        <ChangeList lines={lines}>
          {active ? (
            <p>
              These keys take payments right now. A wrong one stops checkout until it is put right,
              so use Test keys once saved.
            </p>
          ) : (
            <p>
              Checkout is on the {mode === "live" ? "test" : "live"} account, so customers are not
              affected until you switch.
            </p>
          )}
        </ChangeList>
      ),
      confirmLabel: "Save keys",
      run: (done) => savePayment.mutate({ [mode]: input }, { onSettled: done }),
    })
  }

  function removeSaved() {
    ask({
      title: `Remove the saved ${mode} keys?`,
      body: "The key id, secret and webhook secret saved here are deleted. The site goes back to the keys in the server's .env file for this account, if it has any. If this account is taking payments and .env has none, the removal is refused.",
      confirmLabel: "Remove keys",
      tone: "danger",
      run: (done) =>
        savePayment.mutate({ [mode]: { keyId: "", webhookSecret: "" } }, { onSettled: done }),
    })
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <div className="grid gap-5 lg:grid-cols-3">
        <SettingField
          id={id("key-id")}
          label="Key id"
          badge={<SourceBadge source={keys.keyId.source} />}
          error={errors.keyId}
        >
          <Input
            id={id("key-id")}
            value={keyId}
            onChange={(e) => setKeyId(e.target.value)}
            placeholder={`${KEY_PREFIX[mode]}…`}
            autoComplete="off"
            spellCheck={false}
            disabled={!canWrite}
            aria-invalid={Boolean(errors.keyId) || undefined}
            className="font-mono"
          />
        </SettingField>
        <SettingField
          id={id("key-secret")}
          label="Key secret"
          badge={
            <SourceBadge source={keys.keySecret.source} unreadable={keys.keySecret.unreadable} />
          }
          error={errors.keySecret}
        >
          <SecretInput
            id={id("key-secret")}
            value={keySecret}
            onChange={setKeySecret}
            state={keys.keySecret}
            disabled={!canWrite}
            invalid={Boolean(errors.keySecret)}
          />
        </SettingField>
        <SettingField
          id={id("webhook-secret")}
          label="Webhook secret"
          badge={
            <SourceBadge
              source={keys.webhookSecret.source}
              unreadable={keys.webhookSecret.unreadable}
            />
          }
          error={errors.webhookSecret}
        >
          <SecretInput
            id={id("webhook-secret")}
            value={webhookSecret}
            onChange={setWebhookSecret}
            state={keys.webhookSecret}
            disabled={!canWrite}
            invalid={Boolean(errors.webhookSecret)}
          />
        </SettingField>
      </div>
      {canWrite ? <SecretsNote /> : null}

      {canWrite ? (
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={!dirty || savePayment.isPending}
          >
            Save {mode} keys
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            // Tests what is saved, so not while there are unsaved changes.
            disabled={!keys.ready || dirty || testPayment.isPending}
            onClick={() => {
              setAccepted(false)
              testPayment.mutate(mode, { onSuccess: () => setAccepted(true) })
            }}
          >
            Test keys
          </Button>
          {anythingSaved ? (
            <Button type="button" variant="quiet" size="sm" onClick={removeSaved}>
              Remove saved keys
            </Button>
          ) : null}
          {accepted && !dirty ? (
            <span className="text-acid inline-flex items-center gap-1.5 text-[13px]">
              <CheckCircle2 className="size-4" strokeWidth={2} />
              Razorpay accepted them
            </span>
          ) : null}
        </div>
      ) : null}
    </form>
  )
}

export function PaymentSettings({
  payment,
  canWrite,
  ask,
}: {
  payment: Payment
  canWrite: boolean
  ask: Ask
}) {
  return (
    <div className="flex flex-col gap-5">
      <Panel
        title="Taking payments on"
        description="Which Razorpay account checkout uses. Switching takes effect from the next checkout, without a deploy. Payments already taken stay on the account that took them."
      >
        <ModeSwitch payment={payment} canWrite={canWrite} ask={ask} />
      </Panel>

      {PAYMENT_MODES.map((mode) => (
        <Panel
          key={mode}
          title={`${ACCOUNT[mode].title} keys`}
          description={
            <>
              From Razorpay Dashboard, in {mode} mode: Account &amp; Settings → API Keys. The secret
              is shown once when a key is generated. Anything not saved here comes from the
              server&apos;s .env file.
            </>
          }
          aside={
            payment.mode === mode ? (
              <Badge variant={mode === "live" ? "acid" : "violet"}>In use</Badge>
            ) : null
          }
        >
          {/* Keyed on what is saved, so a save resets the form to it. */}
          <KeySetForm
            key={JSON.stringify(payment[mode])}
            mode={mode}
            keys={payment[mode]}
            active={payment.mode === mode}
            canWrite={canWrite}
            ask={ask}
          />
        </Panel>
      ))}

      <Panel
        title="Payment webhook"
        description="Razorpay tells the shop about every payment through this, so an order is marked paid even when the customer closes the page before coming back. Set it up in both test and live mode."
      >
        <CopyLine label="Webhook URL" value={payment.webhookUrl} />
        <ol className="text-ash mt-4 list-decimal space-y-1.5 pl-5 text-[13.5px] leading-[1.6]">
          <li>
            Razorpay Dashboard, switched to test or live mode: Account &amp; Settings → Webhooks →
            Add new webhook.
          </li>
          <li>
            Paste the URL above, make up a secret, and tick the events{" "}
            <span className="text-bone font-mono">payment.captured</span> and{" "}
            <span className="text-bone font-mono">payment.failed</span>.
          </li>
          <li>
            Enter that same secret as the webhook secret of the matching keys above, and save.
          </li>
        </ol>
      </Panel>
    </div>
  )
}
