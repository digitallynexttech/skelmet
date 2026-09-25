"use client"

import * as React from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { FEE_BASES, type FeeBasis } from "@/config/shipping"
import {
  ChangeList,
  Panel,
  SettingField,
  fieldErrors,
} from "@/features/settings/components/settings-parts"
import { useRuntimeSettingsMutations } from "@/features/settings/hooks/use-runtime-settings"
import {
  FEE_BASIS_LABEL,
  shippingChargeSchema,
  type RuntimeSettingsView,
  type ShippingCharge,
} from "@/features/settings/schemas/runtime-settings.schema"
import type { Ask } from "@/hooks/use-confirm"
import { formatMoney } from "@/lib/money"

type Shipping = RuntimeSettingsView["shipping"]

const BASIS_DETAIL: Record<FeeBasis, string> = {
  twoCheapest:
    "The mean of the two lowest courier prices for the parcel, or the only one when there is one. Close to what the shop pays when it picks the courier, without one unusually cheap courier deciding alone.",
  average:
    "The mean of every courier Shiprocket offers. The premium air couriers it always lists pull this up, so more pincodes pay.",
  cheapest: "The lowest courier price alone. The fewest pincodes pay.",
  recommended:
    "The price of the courier Shiprocket recommends, which is often an air courier even for nearby pincodes.",
}

/** The rule in one sentence, as a buyer would meet it. */
function describe(charge: ShippingCharge): string {
  if (charge.feeRupees === 0) return "Shipping is free to every pincode."
  return `Free where couriers cost the shop ${formatMoney(charge.aboveRupees)} or less; ${formatMoney(charge.feeRupees)} per order where they cost more.`
}

function ShippingForm({ data, canWrite, ask }: { data: Shipping; canWrite: boolean; ask: Ask }) {
  const { saveShipping } = useRuntimeSettingsMutations()
  const [feeRupees, setFeeRupees] = React.useState(String(data.feeRupees))
  const [aboveRupees, setAboveRupees] = React.useState(String(data.aboveRupees))
  const [basis, setBasis] = React.useState<FeeBasis>(data.basis)
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  const dirty =
    feeRupees.trim() !== String(data.feeRupees) ||
    aboveRupees.trim() !== String(data.aboveRupees) ||
    basis !== data.basis

  const parsed = shippingChargeSchema.safeParse({
    feeRupees: feeRupees.trim(),
    aboveRupees: aboveRupees.trim(),
    basis,
  })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error.issues))
      return
    }
    setErrors({})
    const charge = parsed.data

    ask({
      title: "Change the shipping charge?",
      body: (
        <ChangeList
          lines={[
            describe(charge),
            ...(charge.feeRupees > 0
              ? [`Courier cost read as: ${FEE_BASIS_LABEL[charge.basis]}`]
              : []),
          ]}
        >
          <p>
            Checkout charges this from the next order. The product page and the shipping policy say
            the same. Orders already placed keep the shipping they paid.
          </p>
        </ChangeList>
      ),
      confirmLabel: "Save charge",
      run: (done) => saveShipping.mutate(charge, { onSettled: done }),
    })
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <div className="grid gap-5 md:grid-cols-2">
        <SettingField
          id="ship-fee"
          label="Charge the buyer, per order"
          hint="0 makes shipping free everywhere."
          error={errors.feeRupees}
        >
          <Input
            id="ship-fee"
            inputMode="numeric"
            value={feeRupees}
            onChange={(e) => setFeeRupees(e.target.value.replace(/[^\d]/g, ""))}
            disabled={!canWrite}
            aria-invalid={Boolean(errors.feeRupees) || undefined}
            className="font-mono"
          />
        </SettingField>
        <SettingField
          id="ship-above"
          label="When couriers cost the shop more than"
          hint="In rupees, for the order's own parcel and pincode."
          error={errors.aboveRupees}
        >
          <Input
            id="ship-above"
            inputMode="numeric"
            value={aboveRupees}
            onChange={(e) => setAboveRupees(e.target.value.replace(/[^\d]/g, ""))}
            disabled={!canWrite}
            aria-invalid={Boolean(errors.aboveRupees) || undefined}
            className="font-mono"
          />
        </SettingField>
      </div>

      <SettingField
        id="ship-basis"
        label="What a courier costs is taken as"
        hint={BASIS_DETAIL[basis]}
      >
        {canWrite ? (
          <Select
            label="What a courier costs is taken as"
            value={basis}
            onChange={setBasis}
            options={FEE_BASES.map((b) => ({ value: b, label: FEE_BASIS_LABEL[b] }))}
          />
        ) : (
          <Input id="ship-basis" value={FEE_BASIS_LABEL[basis]} disabled readOnly />
        )}
      </SettingField>

      <p className="rounded-tile bg-void text-bone border border-white/[0.09] px-4 py-3 text-[14px] leading-[1.55]">
        {parsed.success ? describe(parsed.data) : "Enter whole rupees in both boxes."}
        <span className="text-dim block text-[12.5px]">
          When Shiprocket cannot be asked, shipping is always free: an outage never charges anyone.
        </span>
      </p>

      {canWrite ? (
        <div>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={!dirty || saveShipping.isPending}
          >
            Save shipping charge
          </Button>
        </div>
      ) : null}
    </form>
  )
}

export function ShippingChargeSettings({
  shipping,
  canWrite,
  ask,
}: {
  shipping: Shipping
  canWrite: boolean
  ask: Ask
}) {
  return (
    <Panel
      title="Shipping charge"
      description="What the buyer pays for shipping, worked out at checkout from the couriers Shiprocket offers for their pincode. Takes effect from the next checkout, without a deploy."
      aside={
        shipping.source === "saved" ? (
          <Badge variant="violet">Saved here</Badge>
        ) : (
          <Badge variant="muted">Default</Badge>
        )
      }
    >
      <ShippingForm key={JSON.stringify(shipping)} data={shipping} canWrite={canWrite} ask={ask} />
    </Panel>
  )
}
