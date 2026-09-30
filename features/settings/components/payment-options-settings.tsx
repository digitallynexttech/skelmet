"use client"

import * as React from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { advanceLabel, advanceOf, splitPayment } from "@/features/checkout/payment-options"
import {
  ChangeList,
  Panel,
  SettingField,
  fieldErrors,
} from "@/features/settings/components/settings-parts"
import { useRuntimeSettingsMutations } from "@/features/settings/hooks/use-runtime-settings"
import {
  ADVANCE_KINDS,
  OFFERS,
  OFFER_LABEL,
  paymentOptionsSchema,
  type AdvanceKind,
  type Offer,
  type PaymentOptions,
  type RuntimeSettingsView,
} from "@/features/settings/schemas/runtime-settings.schema"
import type { Ask } from "@/hooks/use-confirm"
import { formatMoney } from "@/lib/money"

type Checkout = RuntimeSettingsView["checkout"]

const OFFER_OPTIONS = OFFERS.map((o) => ({ value: o, label: OFFER_LABEL[o] }))

const OFFER_DETAIL: Record<Offer, string> = {
  off: "Not offered to anyone.",
  staff:
    "Shown at checkout only to someone signed in to this console, in the same browser. Customers see nothing, and the FAQ and terms do not change.",
  everyone: "Offered to every customer, and the FAQ and terms say so.",
}

const ADVANCE_KIND_LABEL: Record<AdvanceKind, string> = {
  PERCENT: "A percentage of the order",
  FLAT: "A fixed amount",
}

/** The order the summaries are worked out on. */
const EXAMPLE_ORDER = 3000

const extra = (rupees: number) => (rupees > 0 ? `${formatMoney(rupees)} extra` : "no extra charge")

/** Each way of paying in one sentence, as a buyer would meet it. */
function describe(options: PaymentOptions): string[] {
  const lines = ["Paying online in full: always offered, no extra charge."]

  if (options.cod.offer === "off") {
    lines.push("Cash on delivery: off.")
  } else {
    lines.push(
      `Cash on delivery: ${extra(options.cod.feeRupees)}, the whole amount to the courier - offered to ${
        options.cod.offer === "staff" ? "staff only, to test" : "everyone"
      }.`,
    )
  }

  if (options.partial.offer === "off") {
    lines.push("Advance, rest on delivery: off.")
  } else {
    const total = EXAMPLE_ORDER + options.partial.feeRupees
    const split = splitPayment("PARTIAL", total, advanceOf(options))
    lines.push(
      `Advance, rest on delivery: ${advanceLabel(advanceOf(options))} now, ${extra(options.partial.feeRupees)} - offered to ${
        options.partial.offer === "staff" ? "staff only, to test" : "everyone"
      }. ${
        split
          ? `On a ${formatMoney(EXAMPLE_ORDER)} order: ${formatMoney(split.payNow)} now, ${formatMoney(split.dueOnDelivery)} on delivery.`
          : `A ${formatMoney(EXAMPLE_ORDER)} order is too small to split this way, so it would not be offered on one.`
      }`,
    )
  }
  return lines
}

const digits = (value: string) => value.replace(/[^\d]/g, "")

function OptionsForm({ data, canWrite, ask }: { data: Checkout; canWrite: boolean; ask: Ask }) {
  const { saveCheckout } = useRuntimeSettingsMutations()
  const [codOffer, setCodOffer] = React.useState<Offer>(data.cod.offer)
  const [codFee, setCodFee] = React.useState(String(data.cod.feeRupees))
  const [partialOffer, setPartialOffer] = React.useState<Offer>(data.partial.offer)
  const [partialFee, setPartialFee] = React.useState(String(data.partial.feeRupees))
  const [advanceKind, setAdvanceKind] = React.useState<AdvanceKind>(data.partial.advanceKind)
  const [advanceValue, setAdvanceValue] = React.useState(String(data.partial.advanceValue))
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  const dirty =
    codOffer !== data.cod.offer ||
    codFee.trim() !== String(data.cod.feeRupees) ||
    partialOffer !== data.partial.offer ||
    partialFee.trim() !== String(data.partial.feeRupees) ||
    advanceKind !== data.partial.advanceKind ||
    advanceValue.trim() !== String(data.partial.advanceValue)

  const parsed = paymentOptionsSchema.safeParse({
    cod: { offer: codOffer, feeRupees: codFee.trim() },
    partial: {
      offer: partialOffer,
      feeRupees: partialFee.trim(),
      advanceKind,
      advanceValue: advanceValue.trim(),
    },
  })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!parsed.success) {
      // Both sections have a `feeRupees`, so the messages are keyed by section.
      const bySection: Record<string, string> = {}
      for (const section of ["cod", "partial"] as const) {
        const own = fieldErrors(parsed.error.issues.filter((i) => i.path[0] === section))
        for (const [field, message] of Object.entries(own)) {
          bySection[`${section}.${field}`] = message
        }
      }
      setErrors(bySection)
      return
    }
    setErrors({})
    const options = parsed.data
    const live = options.cod.offer === "everyone" || options.partial.offer === "everyone"

    ask({
      title: "Change the ways to pay?",
      body: (
        <ChangeList lines={describe(options)}>
          <p>
            Checkout offers this from the next order.{" "}
            {live
              ? "The FAQ and the terms are updated to say how customers can pay."
              : "Nothing a customer sees changes."}{" "}
            Orders already placed keep what they were charged.
          </p>
        </ChangeList>
      ),
      confirmLabel: "Save ways to pay",
      run: (done) => saveCheckout.mutate(options, { onSettled: done }),
    })
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-7">
      <fieldset className="flex flex-col gap-5">
        <legend className="text-bone mb-4 text-[15px] font-semibold">Cash on delivery</legend>
        <div className="grid gap-5 md:grid-cols-2">
          <SettingField id="cod-offer" label="Offered to" hint={OFFER_DETAIL[codOffer]}>
            {canWrite ? (
              <Select
                id="cod-offer"
                label="Cash on delivery is offered to"
                value={codOffer}
                onChange={setCodOffer}
                options={OFFER_OPTIONS}
              />
            ) : (
              <Input id="cod-offer" value={OFFER_LABEL[codOffer]} disabled readOnly />
            )}
          </SettingField>
          <SettingField
            id="cod-fee"
            label="Extra charge (₹)"
            hint="Added to the order when the buyer chooses cash on delivery. 0 for none."
            error={errors["cod.feeRupees"]}
          >
            <Input
              id="cod-fee"
              inputMode="numeric"
              value={codFee}
              onChange={(e) => setCodFee(digits(e.target.value))}
              disabled={!canWrite}
              aria-invalid={Boolean(errors["cod.feeRupees"]) || undefined}
              className="font-mono"
            />
          </SettingField>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-5 border-t border-white/[0.07] pt-7">
        <legend className="text-bone mb-4 text-[15px] font-semibold">
          Advance online, rest on delivery
        </legend>
        <div className="grid gap-5 md:grid-cols-2">
          <SettingField id="partial-offer" label="Offered to" hint={OFFER_DETAIL[partialOffer]}>
            {canWrite ? (
              <Select
                id="partial-offer"
                label="An advance with the rest on delivery is offered to"
                value={partialOffer}
                onChange={setPartialOffer}
                options={OFFER_OPTIONS}
              />
            ) : (
              <Input id="partial-offer" value={OFFER_LABEL[partialOffer]} disabled readOnly />
            )}
          </SettingField>
          <SettingField
            id="partial-fee"
            label="Extra charge (₹)"
            hint="Added to the order when the buyer pays this way. 0 for none."
            error={errors["partial.feeRupees"]}
          >
            <Input
              id="partial-fee"
              inputMode="numeric"
              value={partialFee}
              onChange={(e) => setPartialFee(digits(e.target.value))}
              disabled={!canWrite}
              aria-invalid={Boolean(errors["partial.feeRupees"]) || undefined}
              className="font-mono"
            />
          </SettingField>
          <SettingField id="advance-kind" label="The advance is">
            {canWrite ? (
              <Select
                id="advance-kind"
                label="The advance is"
                value={advanceKind}
                onChange={setAdvanceKind}
                options={ADVANCE_KINDS.map((k) => ({ value: k, label: ADVANCE_KIND_LABEL[k] }))}
              />
            ) : (
              <Input id="advance-kind" value={ADVANCE_KIND_LABEL[advanceKind]} disabled readOnly />
            )}
          </SettingField>
          <SettingField
            id="advance-value"
            label={advanceKind === "PERCENT" ? "Advance (%)" : "Advance (₹)"}
            hint={
              advanceKind === "PERCENT"
                ? "Of the order's total, shipping and any charge included. The rest is rounded down to whole rupees for the courier."
                : "Paid online when the order is placed. An order this amount would cover is not offered the option."
            }
            error={errors["partial.advanceValue"]}
          >
            <Input
              id="advance-value"
              inputMode="numeric"
              value={advanceValue}
              onChange={(e) => setAdvanceValue(digits(e.target.value))}
              disabled={!canWrite}
              aria-invalid={Boolean(errors["partial.advanceValue"]) || undefined}
              className="font-mono"
            />
          </SettingField>
        </div>
      </fieldset>

      <div className="rounded-tile bg-void text-bone border border-white/[0.09] px-4 py-3 text-[14px] leading-[1.55]">
        {parsed.success ? (
          <ul className="flex flex-col gap-1.5">
            {describe(parsed.data).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : (
          "Enter whole numbers in every box."
        )}
        <span className="text-dim mt-2 block text-[12.5px]">
          Paying on delivery is only offered where a courier collects at the buyer&apos;s pincode.
          When Shiprocket cannot be asked, it is offered, and the courier is checked when you book.
        </span>
      </div>

      {canWrite ? (
        <div>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={!dirty || saveCheckout.isPending}
          >
            Save ways to pay
          </Button>
        </div>
      ) : null}
    </form>
  )
}

export function PaymentOptionsSettings({
  checkout,
  canWrite,
  ask,
}: {
  checkout: Checkout
  canWrite: boolean
  ask: Ask
}) {
  return (
    <Panel
      title="Pay on delivery"
      description="Cash on delivery, and an advance online with the rest paid to the courier: who is offered each, and what each adds to the order. Takes effect from the next checkout, without a deploy."
      aside={
        checkout.source === "saved" ? (
          <Badge variant="violet">Saved here</Badge>
        ) : (
          <Badge variant="muted">Default</Badge>
        )
      }
    >
      <OptionsForm key={JSON.stringify(checkout)} data={checkout} canWrite={canWrite} ask={ask} />
    </Panel>
  )
}
