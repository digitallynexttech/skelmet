"use client"

import * as React from "react"
import { CheckCircle2, RefreshCw } from "lucide-react"

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
  shiprocketSettingsSchema,
  type RuntimeSettingsView,
  type ShiprocketSettingsInput,
} from "@/features/settings/schemas/runtime-settings.schema"
import type { Ask } from "@/hooks/use-confirm"

type Shiprocket = RuntimeSettingsView["shiprocket"]

/** 32 random bytes as hex: a token nobody could guess, for Shiprocket to send back. */
function newToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("")
}

function ShiprocketForm({
  data,
  canWrite,
  ask,
}: {
  data: Shiprocket
  canWrite: boolean
  ask: Ask
}) {
  const { saveShiprocket, testShiprocket } = useRuntimeSettingsMutations()
  const savedEmail = data.email.value ?? ""
  const savedPickup = data.pickupLocation.value ?? ""
  const [email, setEmail] = React.useState(savedEmail)
  const [password, setPassword] = React.useState("")
  const [pickupLocation, setPickupLocation] = React.useState(savedPickup)
  const [webhookToken, setWebhookToken] = React.useState("")
  const [generated, setGenerated] = React.useState<string | null>(null)
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [result, setResult] = React.useState<string | null>(null)

  const emailChanged = email.trim() !== savedEmail
  const pickupChanged = pickupLocation.trim() !== savedPickup
  const dirty = emailChanged || password !== "" || pickupChanged || webhookToken.trim() !== ""

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const input: ShiprocketSettingsInput = {}
    if (emailChanged) input.email = email.trim()
    if (password) input.password = password
    if (pickupChanged) input.pickupLocation = pickupLocation.trim()
    if (webhookToken.trim()) input.webhookToken = webhookToken.trim()
    // A password is saved with its user. When the user shown is .env's, a
    // new password for it saves the two together.
    if (input.password && !emailChanged && data.email.source !== "saved" && email.trim()) {
      input.email = email.trim()
    }

    const parsed = shiprocketSettingsSchema.safeParse(input)
    const next = parsed.success ? {} : fieldErrors(parsed.error.issues)
    if (input.email && !input.password) {
      next.password ??= "Enter the password for this API user"
    }
    if (input.password && !email.trim()) next.email ??= "Enter the API user's email"
    setErrors(next)
    if (Object.keys(next).length > 0) return

    const lines = [
      ...(emailChanged
        ? [
            input.email
              ? `API user: ${input.email}`
              : "API user removed - the one in the server's .env is used, if it has one",
          ]
        : []),
      ...(input.password ? ["Password replaced"] : []),
      ...(pickupChanged
        ? [
            input.pickupLocation
              ? `Pickup location: ${input.pickupLocation}`
              : "Pickup location removed",
          ]
        : []),
      ...(input.webhookToken ? ["Tracking webhook token replaced"] : []),
    ]

    ask({
      title: "Save the Shiprocket settings?",
      body: (
        <ChangeList lines={lines}>
          <p>
            The next shipping request - a pincode check, a paid order, a booking - logs in with
            these. A wrong password is refused once, and logins then pause for 15 minutes so
            Shiprocket does not lock the account.
            {input.webhookToken
              ? " Put the same token in Shiprocket's webhook settings, or tracking updates are ignored."
              : ""}
          </p>
        </ChangeList>
      ),
      confirmLabel: "Save",
      run: (done) =>
        saveShiprocket.mutate(input, {
          onSuccess: () => setResult(null),
          onSettled: done,
        }),
    })
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <SettingField
          id="sr-email"
          label="API user email"
          badge={<SourceBadge source={data.email.source} />}
          hint="An API user, not the Shiprocket login you sign in with."
          error={errors.email}
        >
          <Input
            id="sr-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="api-user@example.com"
            autoComplete="off"
            data-1p-ignore
            data-lpignore="true"
            spellCheck={false}
            disabled={!canWrite}
            aria-invalid={Boolean(errors.email) || undefined}
          />
        </SettingField>
        <SettingField
          id="sr-password"
          label="API user password"
          badge={
            <SourceBadge source={data.password.source} unreadable={data.password.unreadable} />
          }
          error={errors.password}
        >
          <SecretInput
            id="sr-password"
            value={password}
            onChange={setPassword}
            state={data.password}
            disabled={!canWrite}
            invalid={Boolean(errors.password)}
          />
        </SettingField>
        <SettingField
          id="sr-pickup"
          label="Pickup location name"
          badge={<SourceBadge source={data.pickupLocation.source} />}
          hint="Exactly as named in Shiprocket → Settings → Pickup Addresses."
          error={errors.pickupLocation}
        >
          <Input
            id="sr-pickup"
            value={pickupLocation}
            onChange={(e) => setPickupLocation(e.target.value)}
            placeholder="Home"
            autoComplete="off"
            disabled={!canWrite}
            aria-invalid={Boolean(errors.pickupLocation) || undefined}
          />
        </SettingField>
        <SettingField
          id="sr-token"
          label="Tracking webhook token"
          badge={
            <SourceBadge
              source={data.webhookToken.source}
              unreadable={data.webhookToken.unreadable}
            />
          }
          error={errors.webhookToken}
        >
          <div className="flex gap-2">
            <div className="min-w-0 flex-1">
              <SecretInput
                id="sr-token"
                value={webhookToken}
                onChange={(v) => {
                  setWebhookToken(v)
                  setGenerated(null)
                }}
                state={data.webhookToken}
                disabled={!canWrite}
                invalid={Boolean(errors.webhookToken)}
              />
            </div>
            {canWrite ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-[52px] shrink-0 px-4"
                onClick={() => {
                  const token = newToken()
                  setWebhookToken(token)
                  setGenerated(token)
                }}
              >
                <RefreshCw className="size-3.5" strokeWidth={1.9} />
                New
              </Button>
            ) : null}
          </div>
        </SettingField>
      </div>

      {canWrite ? <SecretsNote /> : null}

      {generated ? (
        <div className="rounded-tile bg-void flex flex-col gap-2 border border-white/[0.09] p-4">
          <CopyLine
            label="New token - paste it into Shiprocket, then save here"
            value={generated}
          />
        </div>
      ) : null}

      {canWrite ? (
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={!dirty || saveShiprocket.isPending}
          >
            Save Shiprocket settings
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            // Tests what is saved, so not while there are unsaved changes.
            disabled={!data.ready || dirty || testShiprocket.isPending}
            onClick={() => {
              setResult(null)
              testShiprocket.mutate(undefined, {
                onSuccess: ({ pickup }) =>
                  setResult(
                    pickup
                      ? `Logged in. Pickup "${pickup.name}" at ${pickup.pincode}.`
                      : "Logged in. No pickup location is set yet.",
                  ),
              })
            }}
          >
            Test connection
          </Button>
          {result && !dirty ? (
            <span className="text-acid inline-flex items-center gap-1.5 text-[13px]">
              <CheckCircle2 className="size-4" strokeWidth={2} />
              {result}
            </span>
          ) : null}
        </div>
      ) : null}
    </form>
  )
}

export function ShiprocketSettings({
  shiprocket,
  canWrite,
  ask,
}: {
  shiprocket: Shiprocket
  canWrite: boolean
  ask: Ask
}) {
  return (
    <div className="flex flex-col gap-5">
      <Panel
        title="Shiprocket login"
        description="The API user the shop books couriers and checks pincodes with. Change it here if the account is locked or replaced - it takes effect on the next request, without a deploy. Anything not saved here comes from the server's .env file."
        aside={
          shiprocket.ready ? (
            <Badge variant="acid">Login set</Badge>
          ) : (
            <Badge variant="ember">Not set up</Badge>
          )
        }
      >
        <ShiprocketForm
          key={JSON.stringify(shiprocket)}
          data={shiprocket}
          canWrite={canWrite}
          ask={ask}
        />
      </Panel>

      <Panel
        title="Tracking webhook"
        description="Shiprocket tells the shop when a parcel is picked up, in transit and delivered, so the order moves along on its own - including couriers booked in the Shiprocket panel."
      >
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
          <CopyLine label="Webhook URL" value={shiprocket.webhookUrl} />
          <CopyLine label="Token header" value="x-api-key" />
        </div>
        <ol className="text-ash mt-4 list-decimal space-y-1.5 pl-5 text-[13.5px] leading-[1.6]">
          <li>Shiprocket → Settings → API → Webhooks.</li>
          <li>
            Paste the URL above, and the tracking webhook token as the token (Shiprocket sends it as{" "}
            <span className="text-bone font-mono">x-api-key</span>).
          </li>
          <li>
            Updates without the token are ignored, so one has to be set - here, or in the
            server&apos;s .env.
          </li>
        </ol>
      </Panel>
    </div>
  )
}
