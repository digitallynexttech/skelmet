"use client"

import * as React from "react"
import Image from "next/image"
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronDown,
  CreditCard,
  ShieldCheck,
  Truck,
} from "lucide-react"
import type { ZodType } from "zod"

import { CheckoutSteps } from "@/components/shared/checkout-steps"
import { Money } from "@/components/shared/money"
import { Badge } from "@/components/ui/badge"
import { Button, ButtonLink } from "@/components/ui/button"
import { Field, Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { siteConfig } from "@/config/site"
import { CouponBox, type AppliedCoupon } from "@/features/cart/components/coupon-box"
import { calculateTotals, useCart, type CartLine } from "@/features/cart/hooks/use-cart"
import { useCheckout } from "@/features/checkout/hooks/use-checkout"
import { addressSchema, placeOrderSchema } from "@/features/checkout/schemas/checkout.schema"
import type { CheckoutPrefill as Prefill } from "@/features/checkout/server/prefill.service"
import { apiFetch } from "@/lib/api-fetch"
import {
  INDIAN_STATES,
  matchState,
  normalizeMobileInput,
  PINCODE,
  type IndianState,
} from "@/lib/india"
import { useHydrated } from "@/hooks/use-hydrated"

const PROMISES = [
  { Icon: Truck, text: "Dispatched within 48 hours" },
  { Icon: ShieldCheck, text: "7-day returns, pickup on us" },
  { Icon: Check, text: "No account needed to order" },
]

const STATE_OPTIONS = INDIAN_STATES.map((s) => ({ value: s, label: s }))

/** The form's fields, in the order the page shows them. */
const FIELDS = [
  "email",
  "phone",
  "firstName",
  "lastName",
  "line1",
  "line2",
  "pincode",
  "city",
  "state",
] as const
type FieldName = (typeof FIELDS)[number]

/**
 * Each field's rule, taken from the schema the server applies, so a field
 * the page accepts is one the server accepts.
 */
const RULES: Record<FieldName, ZodType> = {
  email: placeOrderSchema.shape.email,
  phone: placeOrderSchema.shape.phone,
  ...addressSchema.shape,
}

const isField = (name: string): name is FieldName => (FIELDS as readonly string[]).includes(name)

function problem(name: FieldName, value: string): string | null {
  const checked = RULES[name].safeParse(value)
  return checked.success ? null : (checked.error.issues[0]?.message ?? "Check this")
}

/** What /api/public/shipping/pincode answers. */
type PincodeAnswer = {
  live: boolean
  serviceable: boolean
  days: number | null
  found: boolean
  city: string | null
  state: string | null
  shippingFee: number
}

/** Whether the pincode typed can be delivered to, and what shipping there costs the buyer. */
type Reach =
  | { status: "idle" }
  | { status: "checking"; pin: string }
  | { status: "ok"; pin: string; fee: number }
  | { status: "blocked"; pin: string; message: string }
  /**
   * Shiprocket did not answer. Shown like "ok" with free shipping, as the
   * product page does and as the server will charge: it checks again at
   * payment, and an outage must neither refuse nor charge anyone.
   */
  | { status: "unknown"; pin: string }

/** Mounts in the cart: the parcel the pincode check prices. */
const unitsIn = (lines: CartLine[]) =>
  Math.max(
    1,
    lines.reduce((n, l) => n + l.qty, 0),
  )

function Lines({ items }: { items: CartLine[] }) {
  return (
    <ul className="mb-5 flex flex-col gap-4">
      {items.map((line) => (
        <li key={line.id} className="flex items-center gap-3.5">
          <div className="relative size-14 shrink-0">
            <div className="bg-void relative size-full overflow-hidden rounded-lg">
              <Image src={line.image} alt="" fill sizes="56px" className="object-cover" />
            </div>
            <Badge
              variant="blaze"
              className="absolute -top-1.5 -right-1.5 min-w-5 justify-center rounded-full px-1.5 py-0.5"
            >
              {line.qty}
            </Badge>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-bone truncate text-sm font-semibold">{line.productName}</div>
            <div className="text-dim mt-0.5 font-mono text-[11px] tracking-[0.1em]">
              {line.colourwayName.toUpperCase()}
            </div>
            {line.qty > 1 ? (
              <div className="text-ash mt-1 text-[11.5px]">
                {line.qty} × <Money value={line.unitPrice} />
              </div>
            ) : null}
          </div>
          <Money
            value={Number(line.unitPrice) * line.qty}
            className="text-bone shrink-0 font-mono text-sm"
          />
        </li>
      ))}
    </ul>
  )
}

/**
 * The line under the pincode while it is checked, and once it can be delivered to.
 *
 * Always the shop's own promise, never the courier's transit time. Shiprocket
 * can say "2 days" for a nearby pincode, but that clock starts at pickup, and
 * the shop takes its own time to pack and dispatch first - quoting the courier
 * alone promised a delivery the shop cannot make.
 */
function PincodeStatus({ reach, pin }: { reach: Reach; pin: string }) {
  if (reach.status === "checking" && reach.pin === pin) {
    return <span className="text-dim text-[12.5px] leading-[1.45]">Checking delivery…</span>
  }
  if ((reach.status === "ok" || reach.status === "unknown") && reach.pin === pin) {
    const fee = reach.status === "ok" ? reach.fee : 0
    return (
      <span className="flex flex-col gap-1 text-[12.5px] leading-[1.45]">
        <span className="text-acid flex items-start gap-1.5">
          <Check className="mt-[2px] size-3.5 shrink-0" strokeWidth={2.6} />
          We deliver here - dispatched within {siteConfig.promise.dispatchHours} hours, delivered
          within {siteConfig.promise.deliveryDays}.
        </span>
        <span className="text-ash pl-5">
          {fee > 0 ? (
            <>
              Shipping to this pincode: <Money value={fee} className="text-bone font-mono" />
            </>
          ) : (
            "Free shipping to this pincode."
          )}
        </span>
      </span>
    )
  }
  return null
}

export function CheckoutView({ prices }: { prices: Record<string, string> }) {
  const items = useCart((s) => s.items)
  const syncPrices = useCart((s) => s.syncPrices)
  React.useEffect(() => syncPrices(prices), [prices, syncPrices])
  const couponCode = useCart((s) => s.couponCode)
  const mounted = useHydrated()
  const { submit, pending, error } = useCheckout()
  const [coupon, setCoupon] = React.useState<AppliedCoupon | null>(null)
  const formRef = React.useRef<HTMLFormElement>(null)
  const [prefilled, setPrefilled] = React.useState(false)

  // One message per field, shown under it. Checked as each field is left and
  // all together on submit, with the schema the server uses.
  const [errors, setErrors] = React.useState<Partial<Record<FieldName, string>>>({})
  const [formError, setFormError] = React.useState<string | null>(null)
  const setError = React.useCallback((name: FieldName, message: string | null) => {
    setErrors((prev) => {
      if (message) return prev[name] === message ? prev : { ...prev, [name]: message }
      if (!(name in prev)) return prev
      const next = { ...prev }
      delete next[name]
      return next
    })
  }, [])

  // Controlled, unlike the rest of the form: the pincode drives a lookup, and
  // the city and state are filled in from its answer.
  const [pincode, setPincode] = React.useState("")
  const [city, setCity] = React.useState("")
  const [stateName, setStateName] = React.useState<IndianState | "">("")
  const [reach, setReach] = React.useState<Reach>({ status: "idle" })
  // Only the latest lookup may answer: a slow reply for a pincode that has
  // since been edited must not fill in the wrong city.
  const lookupTicket = React.useRef(0)
  const pincodeTyped = React.useRef("")

  /**
   * Asks the server whether the pincode can be delivered to, and where it is.
   *
   * A pincode the buyer typed fills the city and state in, over whatever was
   * there, since the pincode is the more reliable of the three; they can still
   * change either afterwards. One restored from a previous order only fills
   * what is empty, so it never overwrites an address someone saved.
   */
  const lookUp = React.useCallback(
    async (pin: string, fill: "replace" | "blanks", units: number) => {
      const ticket = ++lookupTicket.current
      setReach({ status: "checking", pin })
      try {
        const answer = await apiFetch<PincodeAnswer>(
          `/api/public/shipping/pincode?pincode=${encodeURIComponent(pin)}&units=${units}`,
        )
        if (ticket !== lookupTicket.current) return

        const place = answer.city
        const state = matchState(answer.state)
        if (place) setCity((current) => (fill === "replace" || !current.trim() ? place : current))
        if (state) setStateName((current) => (fill === "replace" || !current ? state : current))
        if (fill === "replace") {
          if (place) setError("city", null)
          if (state) setError("state", null)
        }

        if (!answer.found) {
          setReach({
            status: "blocked",
            pin,
            message: `We couldn't find pincode ${pin}. Check the number.`,
          })
        } else if (answer.live && !answer.serviceable) {
          setReach({
            status: "blocked",
            pin,
            message: `Couriers don't reach ${pin} yet, so we can't deliver there. Message us and we'll try to arrange it.`,
          })
        } else {
          setReach(
            answer.live
              ? { status: "ok", pin, fee: answer.shippingFee }
              : { status: "unknown", pin },
          )
        }
      } catch {
        // Rate-limited or offline. The city and state can still be typed, and
        // the server checks the pincode again when the order is placed.
        if (ticket === lookupTicket.current) setReach({ status: "unknown", pin })
      }
    },
    [setError],
  )

  function handlePincode(event: React.ChangeEvent<HTMLInputElement>) {
    // Digits only, at most six: paste, autofill and keypress all land here.
    const pin = event.target.value.replace(/\D/g, "").slice(0, 6)
    setPincode(pin)
    pincodeTyped.current = pin
    setError("pincode", pin.length === 6 ? problem("pincode", pin) : null)
    if (PINCODE.test(pin)) {
      void lookUp(pin, "replace", unitsIn(items))
    } else {
      lookupTicket.current++
      setReach({ status: "idle" })
    }
  }

  // Fill in a returning buyer's details from their last order.
  //
  // Authorised entirely by the httpOnly cookie the server reads - nothing
  // typed here asks for it. An email-triggered lookup would be the obvious
  // version and cannot be built safely: with no account to sign in to, an
  // email is not a secret, so it would hand anyone the home address of any
  // customer whose address they could guess.
  //
  // The uncontrolled inputs are written straight into the DOM - defaultValue
  // only applies on mount, and the answer arrives after it. The pincode, city
  // and state are React state, so they are set as state.
  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const saved = await apiFetch<Prefill | null>("/api/public/checkout/prefill")
        if (cancelled || !saved || !formRef.current) return
        const el = formRef.current.elements
        const set = (nameAttr: string, value: string) => {
          const field = el.namedItem(nameAttr)
          // Never overwrite something the visitor has already typed.
          if (field instanceof HTMLInputElement && !field.value) field.value = value
        }
        set("email", saved.email)
        // Saved before the field took digits only, it may carry +91 or spaces.
        set("phone", normalizeMobileInput(saved.phone))
        const { pincode: savedPin, city: savedCity, state: savedState, ...rest } = saved.address
        for (const [k, v] of Object.entries(rest)) set(k, v)
        if (savedCity) setCity((current) => current || savedCity)
        // A state saved as free text only comes back if it is a real one.
        const state = matchState(savedState)
        if (state) setStateName((current) => current || state)
        if (!pincodeTyped.current && PINCODE.test(savedPin)) {
          pincodeTyped.current = savedPin
          setPincode(savedPin)
          // Read from the store, not a render: this effect runs once, and must
          // not run again each time the cart changes.
          void lookUp(savedPin, "blanks", unitsIn(useCart.getState().items))
        }
        setPrefilled(true)
      } catch {
        // No saved order, or the lookup failed. An empty form is the same
        // outcome as never having ordered, so there is nothing to say.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [lookUp])

  // Shipping is only known once this pincode has been checked; until then the
  // summary says it comes from the pincode, and the total leaves it out.
  const pincodeChecked =
    (reach.status === "ok" || reach.status === "unknown") && reach.pin === pincode
  const shippingFee = reach.status === "ok" && reach.pin === pincode ? reach.fee : 0
  const totals = calculateTotals(items, false, coupon?.discount ?? 0, shippingFee)

  /** Focuses the first control inside a field, which also scrolls it into view. */
  function reveal(name: FieldName) {
    document
      .getElementById(`field-${name}`)
      ?.querySelector<HTMLElement>("input:not([type=hidden]), button")
      ?.focus()
  }

  // A field is checked when it is left, once there is something in it: an
  // empty field is for submit to point out, not for tabbing past.
  function handleBlur(event: React.FocusEvent<HTMLFormElement>) {
    const el = event.target
    if (!(el instanceof HTMLInputElement) || !isField(el.name)) return
    const value = el.value.trim()
    if (value) setError(el.name, problem(el.name, value))
  }

  // Typing into a field clears its message; it is checked again on leaving.
  function handleChange(event: React.ChangeEvent<HTMLFormElement>) {
    const el = event.target as unknown as HTMLInputElement
    if (el.name !== "pincode" && isField(el.name)) setError(el.name, null)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const str = (k: string) => String(form.get(k) ?? "").trim()
    setFormError(null)

    const parsed = placeOrderSchema.safeParse({
      email: str("email"),
      phone: str("phone"),
      address: {
        firstName: str("firstName"),
        lastName: str("lastName"),
        line1: str("line1"),
        line2: str("line2"),
        city: city.trim(),
        state: stateName,
        pincode,
      },
      // Only SKUs and quantities cross the wire; the server prices the order.
      items: items.map((l) => ({ sku: l.sku, qty: l.qty })),
      // The field below lives in a `hidden lg:flex` rail, so on a phone it is
      // present but invisible - which is why the code applied on /cart has to
      // seed it rather than being re-typed somewhere it cannot be typed.
      // The named input is gone - CouponBox validates before anything is
      // applied, so the code that goes to the server is the one it accepted,
      // falling back to whatever the cart is still carrying.
      couponCode: coupon?.code ?? couponCode ?? "",
      paymentMethod: "ONLINE",
      saveAddress: false,
    })

    const found: Partial<Record<FieldName, string>> = {}
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = String(issue.path.at(-1) ?? "")
        if (isField(key) && !found[key]) found[key] = issue.message
      }
    }
    // Paying for a parcel no courier can bring is money to refund later.
    if (reach.status === "blocked" && reach.pin === pincode && !found.pincode) {
      found.pincode = reach.message
    }

    const first = FIELDS.find((name) => found[name])
    if (first) {
      setErrors(found)
      reveal(first)
      return
    }
    if (!parsed.success) {
      // Not a field on this page - the cart or the coupon.
      setFormError(parsed.error.issues[0]?.message ?? "Something in your order needs another look.")
      return
    }

    await submit(parsed.data)
  }

  if (!mounted) return <div className="min-h-[60vh]" aria-hidden />

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center px-5 py-24 text-center">
        <h1 className="font-display text-bone mb-4 text-[40px] leading-[1.0] uppercase sm:text-[56px]">
          Nothing to check out
        </h1>
        <p className="text-ash mb-8 max-w-[380px] text-[15.5px] leading-[1.6]">
          Add a mount to your cart first and this page will have something to do.
        </p>
        <ButtonLink href="/product/flame-skull-mount" variant="primary" size="lg">
          Shop the mount
          <ArrowRight className="size-4" strokeWidth={2.4} />
        </ButtonLink>
      </div>
    )
  }

  return (
    // noValidate: the browser's own bubbles would fire before, and instead of,
    // the messages under each field.
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      onBlur={handleBlur}
      onChange={handleChange}
      noValidate
      className="pb-24"
    >
      <details className="bg-carbon border-b border-white/[0.07] lg:hidden">
        <summary className="flex list-none items-center justify-between px-5 py-3.5">
          <span className="text-bone flex items-center gap-2.5 text-[13.5px]">
            Order summary ({totals.itemCount})
            <ChevronDown className="text-dim size-4" strokeWidth={2} />
          </span>
          <Money value={totals.total} className="font-display text-bone text-[22px]" />
        </summary>
        <div className="border-t border-white/[0.07] px-5 py-4">
          <Lines items={items} />
        </div>
      </details>

      <div className="flex flex-col gap-6 px-5 pt-9 sm:px-8 lg:flex-row lg:items-end lg:justify-between xl:px-14">
        <div>
          <div className="text-ember mb-3.5 font-mono text-[11.5px] tracking-[0.22em] uppercase">
            Step 02 of 03
          </div>
          <h1 className="font-display text-bone text-[42px] leading-[1.0] uppercase sm:text-[56px] xl:text-[66px]">
            Where&apos;s it going?
          </h1>
        </div>
        <CheckoutSteps current={2} />
      </div>

      <div className="grid gap-10 px-5 pt-8 sm:px-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-12 xl:px-14">
        <div>
          {/* 1 · contact */}
          <section className="rounded-tile bg-carbon mb-3.5 border border-white/[0.09] p-5 sm:p-6">
            <div className="mb-5 flex items-center gap-3.5">
              <span className="bg-blaze text-void flex size-7 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold">
                1
              </span>
              <h2 className="font-display text-bone text-[24px] leading-[1.08] uppercase sm:text-[26px]">
                Contact
              </h2>
            </div>

            {/* Say where the details came from. Fields that fill themselves are
                unnerving otherwise, and a stale address that someone did not
                notice is a parcel sent to the wrong house. */}
            {prefilled ? (
              <p className="text-acid mb-5 flex items-start gap-2 text-[12.5px] leading-[1.5]">
                <Check className="mt-[2px] size-3.5 shrink-0" strokeWidth={2.6} />
                Filled in from your last order on this device. Change anything that has moved.
              </p>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Email" id="field-email" error={errors.email}>
                <Input
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  aria-invalid={Boolean(errors.email)}
                />
              </Field>
              <Field label="Phone" id="field-phone" error={errors.phone}>
                {/* Digits only, ten at most, as it is typed or pasted: a
                    pasted "+91 98765 43210" becomes 9876543210. No maxLength,
                    which would cut that paste short before it is cleaned. */}
                <Input
                  name="phone"
                  type="tel"
                  inputMode="numeric"
                  required
                  autoComplete="tel-national"
                  placeholder="10-digit mobile number"
                  aria-invalid={Boolean(errors.phone)}
                  onChange={(e) => {
                    const clean = normalizeMobileInput(e.currentTarget.value)
                    if (clean !== e.currentTarget.value) e.currentTarget.value = clean
                  }}
                  className="font-mono tracking-[0.06em]"
                />
              </Field>
            </div>
          </section>

          {/* 2 · delivery */}
          <section className="rounded-tile border-blaze/35 bg-carbon mb-3.5 border bg-[linear-gradient(160deg,rgb(255_90_31_/_0.06),transparent_46%)] p-5 sm:p-7">
            <div className="mb-6 flex items-center gap-3.5">
              <span className="bg-blaze text-void flex size-7 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold">
                2
              </span>
              <h2 className="font-display text-bone text-[24px] leading-[1.08] uppercase sm:text-[28px]">
                Delivery address
              </h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="First name" id="field-firstName" error={errors.firstName}>
                <Input
                  name="firstName"
                  required
                  autoComplete="given-name"
                  aria-invalid={Boolean(errors.firstName)}
                />
              </Field>
              <Field label="Last name" id="field-lastName" error={errors.lastName}>
                <Input
                  name="lastName"
                  required
                  autoComplete="family-name"
                  aria-invalid={Boolean(errors.lastName)}
                />
              </Field>
              <Field
                label="Address line 1"
                id="field-line1"
                error={errors.line1}
                className="sm:col-span-2"
              >
                <Input
                  name="line1"
                  required
                  autoComplete="address-line1"
                  placeholder="House number, street"
                  aria-invalid={Boolean(errors.line1)}
                />
              </Field>
              <Field
                label="Address line 2 (optional)"
                id="field-line2"
                error={errors.line2}
                className="sm:col-span-2"
              >
                <Input
                  name="line2"
                  autoComplete="address-line2"
                  placeholder="Landmark, area"
                  aria-invalid={Boolean(errors.line2)}
                />
              </Field>
              <Field
                label="Pincode"
                id="field-pincode"
                error={
                  errors.pincode ??
                  (reach.status === "blocked" && reach.pin === pincode ? reach.message : undefined)
                }
              >
                <Input
                  name="pincode"
                  value={pincode}
                  onChange={handlePincode}
                  required
                  inputMode="numeric"
                  autoComplete="postal-code"
                  placeholder="6-digit pincode"
                  aria-invalid={Boolean(
                    errors.pincode || (reach.status === "blocked" && reach.pin === pincode),
                  )}
                  className="font-mono tracking-[0.08em]"
                />
                {errors.pincode ? null : <PincodeStatus reach={reach} pin={pincode} />}
              </Field>
              <Field label="City" id="field-city" error={errors.city}>
                <Input
                  name="city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  required
                  autoComplete="address-level2"
                  placeholder="Filled in from the pincode"
                  aria-invalid={Boolean(errors.city)}
                />
              </Field>
              <Field label="State" id="field-state" error={errors.state} className="sm:col-span-2">
                <Select
                  value={stateName}
                  options={STATE_OPTIONS}
                  onChange={(next) => {
                    setStateName(next)
                    setError("state", null)
                  }}
                  label="State"
                  placeholder="Choose your state"
                  invalid={Boolean(errors.state)}
                />
              </Field>
            </div>
          </section>

          {/* 3 · payment */}
          <section className="rounded-tile bg-carbon border border-white/[0.09] p-5 sm:p-6">
            <div className="mb-5 flex items-center gap-3.5">
              <span className="bg-blaze text-void flex size-7 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold">
                3
              </span>
              <h2 className="font-display text-bone text-[24px] leading-[1.08] uppercase sm:text-[28px]">
                Payment
              </h2>
            </div>

            {/* One method, so this states it rather than asking. */}
            <div className="border-blaze bg-blaze/[0.08] flex items-start gap-3.5 rounded-xl border p-4">
              <CreditCard className="text-blaze mt-0.5 size-5 shrink-0" strokeWidth={1.8} />
              <span>
                <span className="text-bone block text-[14.5px] font-semibold">Pay now</span>
                <span className="text-ash mt-1 block text-[12.5px] leading-[1.45]">
                  UPI, cards and netbanking via Razorpay
                </span>
              </span>
            </div>
          </section>

          {formError || error ? (
            <div className="border-magenta/35 bg-magenta/[0.06] mt-5 flex items-start gap-3 rounded-xl border p-4">
              <AlertTriangle className="text-magenta mt-0.5 size-4 shrink-0" strokeWidth={1.9} />
              <p className="text-bone text-[13.5px] leading-[1.5]">{formError ?? error}</p>
            </div>
          ) : null}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            full
            className="mt-6"
            disabled={pending}
          >
            {pending ? (
              "Working…"
            ) : (
              <>
                Pay <Money value={totals.total} />
                <ArrowRight className="size-4" strokeWidth={2.4} />
              </>
            )}
          </Button>
        </div>

        {/* Desktop summary rail */}
        {/* Sticky: the form beside this is long enough to scroll the total
            off screen, and the running total is the thing people check
            while they fill it in. top-[90px] clears the 74px sticky header plus a 16px gap. */}
        <aside className="hidden flex-col gap-3.5 lg:sticky lg:top-[90px] lg:flex lg:max-h-[calc(100dvh-106px)] lg:self-start lg:overflow-y-auto">
          <div className="rounded-card bg-carbon border border-white/10 p-6">
            <h2 className="font-display text-bone mb-5 text-[24px] leading-[1.08] uppercase">
              Your order
            </h2>
            <Lines items={items} />

            <CouponBox subtotal={totals.subtotal} applied={coupon} onApplied={setCoupon} />

            <dl className="flex flex-col gap-3 border-y border-white/10 py-5">
              <div className="flex justify-between text-sm">
                <dt className="text-ash">Subtotal</dt>
                <dd className="text-bone font-mono">
                  <Money value={totals.subtotal} />
                </dd>
              </div>
              {coupon && totals.couponOff > 0 ? (
                <div className="flex justify-between text-sm">
                  <dt className="text-ash">{coupon.label}</dt>
                  <dd className="text-acid font-mono">
                    &minus; <Money value={totals.couponOff} />
                  </dd>
                </div>
              ) : null}
              <div className="flex justify-between text-sm">
                <dt className="text-ash">Shipping</dt>
                {!pincodeChecked ? (
                  <dd className="text-dim text-[13px]">By pincode</dd>
                ) : shippingFee > 0 ? (
                  <dd className="text-bone font-mono">
                    <Money value={shippingFee} />
                  </dd>
                ) : (
                  <dd className="text-acid font-mono">FREE</dd>
                )}
              </div>
            </dl>

            <div className="flex items-baseline justify-between pt-5">
              <span className="text-bone text-[15px] font-semibold">Total</span>
              <Money value={totals.total} className="font-display text-bone text-[38px]" />
            </div>
          </div>

          <ul className="rounded-tile bg-carbon flex flex-col gap-3 border border-white/[0.08] p-5">
            {PROMISES.map(({ Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <Icon className="text-acid size-4 shrink-0" strokeWidth={1.8} />
                <span className="text-ash text-[13.5px]">{text}</span>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </form>
  )
}
