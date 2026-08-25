"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  Check,
  ChevronDown,
  CreditCard,
  Lock,
  ShieldCheck,
  Truck,
} from "lucide-react"

import { Money } from "@/components/shared/money"
import { Badge } from "@/components/ui/badge"
import { Button, ButtonLink } from "@/components/ui/button"
import { Field, Input } from "@/components/ui/input"
import { calculateTotals, useCart, type CartLine } from "@/features/cart/hooks/use-cart"
import { useCheckout } from "@/features/checkout/hooks/use-checkout"
import { useHydrated } from "@/hooks/use-hydrated"
import { cn } from "@/lib/utils"

const PROMISES = [
  { Icon: Truck, text: "Dispatched within 48 hours" },
  { Icon: ShieldCheck, text: "7-day returns, pickup on us" },
  { Icon: Check, text: "No account needed to order" },
]

function Lines({ items }: { items: CartLine[] }) {
  return (
    <ul className="mb-5 flex flex-col gap-4">
      {items.map((line) => (
        <li key={line.id} className="flex items-center gap-3.5">
          <div className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-void">
            <Image src={line.image} alt="" fill sizes="56px" className="object-cover" />
            <Badge
              variant="blaze"
              className="absolute -top-1.5 -right-1.5 min-w-5 justify-center rounded-full px-1.5 py-0.5"
            >
              {line.qty}
            </Badge>
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-bone">{line.productName}</div>
            <div className="mt-0.5 font-mono text-[11px] tracking-[0.1em] text-dim">
              {line.colourwayName.toUpperCase()}
            </div>
          </div>
          <Money
            value={Number(line.unitPrice) * line.qty}
            className="shrink-0 font-mono text-sm text-bone"
          />
        </li>
      ))}
    </ul>
  )
}

export function CheckoutView() {
  const items = useCart((s) => s.items)
  const mounted = useHydrated()
  const [method, setMethod] = React.useState<"ONLINE" | "COD">("ONLINE")
  const { submit, pending, error } = useCheckout()
  const totals = calculateTotals(items, method === "COD")

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const str = (k: string) => String(form.get(k) ?? "").trim()

    await submit({
      email: str("email"),
      phone: str("phone"),
      address: {
        firstName: str("firstName"),
        lastName: str("lastName"),
        line1: str("line1"),
        line2: str("line2"),
        city: str("city"),
        state: str("state"),
        pincode: str("pincode"),
      },
      // Only SKUs and quantities cross the wire; the server prices the order.
      items: items.map((l) => ({ sku: l.sku, qty: l.qty })),
      couponCode: str("couponCode"),
      paymentMethod: method,
      saveAddress: false,
      giftNote: form.get("giftNote") === "on",
    })
  }

  if (!mounted) return <div className="min-h-[60vh]" aria-hidden />

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center px-5 py-24 text-center">
        <h1 className="mb-4 font-display text-[40px] leading-[1.0] text-bone uppercase sm:text-[56px]">
          Nothing to check out
        </h1>
        <p className="mb-8 max-w-[380px] text-[15.5px] leading-[1.6] text-ash">
          Add a mount to your cart first and this page will have something to do.
        </p>
        <ButtonLink href="/shop" variant="primary" size="lg">
          Shop the mount
          <ArrowRight className="size-4" strokeWidth={2.4} />
        </ButtonLink>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="pb-24">
      <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4 sm:px-8 xl:px-14">
        <Link href="/cart" className="text-sm text-ash transition-colors hover:text-bone">
          &larr; Back to cart
        </Link>
        <div className="flex items-center gap-2.5 font-mono text-[11px] tracking-[0.14em] text-acid uppercase">
          <Lock className="size-[15px]" strokeWidth={1.9} />
          <span className="hidden sm:inline">Secure checkout · 256-bit TLS</span>
          <span className="sm:hidden">Secure</span>
        </div>
      </div>

      <details className="border-b border-white/[0.07] bg-carbon lg:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-3.5">
          <span className="flex items-center gap-2.5 text-[13.5px] text-bone">
            Order summary ({totals.itemCount})
            <ChevronDown className="size-4 text-dim" strokeWidth={2} />
          </span>
          <Money value={totals.total} className="font-display text-[22px] text-bone" />
        </summary>
        <div className="border-t border-white/[0.07] px-5 py-4">
          <Lines items={items} />
        </div>
      </details>

      <div className="grid gap-10 px-5 pt-9 sm:px-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-12 xl:px-14">
        <div>
          <div className="mb-3.5 font-mono text-[11.5px] tracking-[0.22em] text-ember uppercase">
            Step 02 of 03
          </div>
          <h1 className="mb-9 font-display text-[42px] leading-[1.0] text-bone uppercase sm:text-[56px] xl:text-[66px]">
            Where&apos;s it going?
          </h1>

          {/* 1 · contact */}
          <section className="mb-3.5 rounded-tile border border-white/[0.09] bg-carbon p-5 sm:p-6">
            <div className="mb-5 flex items-center gap-3.5">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-blaze font-mono text-xs font-bold text-void">
                1
              </span>
              <h2 className="font-display text-[24px] leading-[1.08] text-bone uppercase sm:text-[26px]">
                Contact
              </h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Email">
                <Input
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                />
              </Field>
              <Field label="Phone">
                <Input name="phone" type="tel" required autoComplete="tel" placeholder="+91" />
              </Field>
            </div>
          </section>

          {/* 2 · delivery */}
          <section className="mb-3.5 rounded-tile border border-blaze/35 bg-[linear-gradient(160deg,rgb(255_90_31_/_0.06),transparent_46%)] bg-carbon p-5 sm:p-7">
            <div className="mb-6 flex items-center gap-3.5">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-blaze font-mono text-xs font-bold text-void">
                2
              </span>
              <h2 className="font-display text-[24px] leading-[1.08] text-bone uppercase sm:text-[28px]">
                Delivery address
              </h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="First name">
                <Input name="firstName" required autoComplete="given-name" />
              </Field>
              <Field label="Last name">
                <Input name="lastName" required autoComplete="family-name" />
              </Field>
              <Field label="Address line 1" className="sm:col-span-2">
                <Input name="line1" required autoComplete="address-line1" />
              </Field>
              <Field label="Address line 2 (optional)" className="sm:col-span-2">
                <Input name="line2" autoComplete="address-line2" placeholder="Landmark, area" />
              </Field>
              <Field label="Pincode">
                <Input
                  name="pincode"
                  required
                  inputMode="numeric"
                  pattern="[1-9][0-9]{5}"
                  autoComplete="postal-code"
                  className="font-mono tracking-[0.08em]"
                />
              </Field>
              <Field label="City">
                <Input name="city" required autoComplete="address-level2" />
              </Field>
              <Field label="State" className="sm:col-span-2">
                <Input name="state" required autoComplete="address-level1" />
              </Field>
            </div>

            <label className="mt-5 flex cursor-pointer items-center gap-3 text-[14px] text-ash">
              <input type="checkbox" name="giftNote" className="size-4 accent-[var(--color-blaze)]" />
              This is a gift, leave the invoice out of the box
            </label>
          </section>

          {/* 3 · payment */}
          <section className="rounded-tile border border-white/[0.09] bg-carbon p-5 sm:p-6">
            <div className="mb-5 flex items-center gap-3.5">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-blaze font-mono text-xs font-bold text-void">
                3
              </span>
              <h2 className="font-display text-[24px] leading-[1.08] text-bone uppercase sm:text-[28px]">
                Payment
              </h2>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setMethod("ONLINE")}
                aria-pressed={method === "ONLINE"}
                className={cn(
                  "flex items-start gap-3.5 rounded-xl border p-4 text-left transition-colors",
                  method === "ONLINE"
                    ? "border-blaze bg-blaze/[0.08]"
                    : "border-white/[0.12] hover:border-white/25",
                )}
              >
                <CreditCard
                  className={cn(
                    "mt-0.5 size-5 shrink-0",
                    method === "ONLINE" ? "text-blaze" : "text-dim",
                  )}
                  strokeWidth={1.8}
                />
                <span>
                  <span className="block text-[14.5px] font-semibold text-bone">Pay now</span>
                  <span className="mt-1 block text-[12.5px] leading-[1.45] text-ash">
                    UPI, cards and netbanking via Razorpay
                  </span>
                </span>
              </button>

              <button
                type="button"
                onClick={() => setMethod("COD")}
                aria-pressed={method === "COD"}
                className={cn(
                  "flex items-start gap-3.5 rounded-xl border p-4 text-left transition-colors",
                  method === "COD"
                    ? "border-blaze bg-blaze/[0.08]"
                    : "border-white/[0.12] hover:border-white/25",
                )}
              >
                <Banknote
                  className={cn(
                    "mt-0.5 size-5 shrink-0",
                    method === "COD" ? "text-blaze" : "text-dim",
                  )}
                  strokeWidth={1.8}
                />
                <span>
                  <span className="block text-[14.5px] font-semibold text-bone">
                    Cash on delivery
                  </span>
                  <span className="mt-1 block text-[12.5px] leading-[1.45] text-ash">
                    Adds a <Money value={49} /> handling charge
                  </span>
                </span>
              </button>
            </div>
          </section>

          {error ? (
            <div className="mt-5 flex items-start gap-3 rounded-xl border border-magenta/35 bg-magenta/[0.06] p-4">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-magenta" strokeWidth={1.9} />
              <p className="text-[13.5px] leading-[1.5] text-bone">{error}</p>
            </div>
          ) : null}

          <Button type="submit" variant="primary" size="lg" full className="mt-6" disabled={pending}>
            {pending ? (
              "Working…"
            ) : method === "COD" ? (
              <>
                Place order
                <ArrowRight className="size-4" strokeWidth={2.4} />
              </>
            ) : (
              <>
                Pay <Money value={totals.total} />
                <ArrowRight className="size-4" strokeWidth={2.4} />
              </>
            )}
          </Button>
        </div>

        {/* Desktop summary rail */}
        <aside className="hidden flex-col gap-3.5 lg:flex">
          <div className="rounded-card border border-white/10 bg-carbon p-6">
            <h2 className="mb-5 font-display text-[24px] leading-[1.08] text-bone uppercase">
              Your order
            </h2>
            <Lines items={items} />

            <div className="mb-5 flex h-12 items-center rounded-xl border border-white/[0.12] bg-void px-4">
              <Input
                name="couponCode"
                placeholder="Discount code"
                aria-label="Discount code"
                className="h-auto border-0 bg-transparent px-0 font-mono text-[13px] tracking-[0.08em] uppercase focus:ring-0"
              />
            </div>

            <dl className="flex flex-col gap-3 border-y border-white/10 py-5">
              <div className="flex justify-between text-sm">
                <dt className="text-ash">Subtotal</dt>
                <dd className="font-mono text-bone">
                  <Money value={totals.subtotal} />
                </dd>
              </div>
              {totals.discount > 0 ? (
                <div className="flex justify-between text-sm">
                  <dt className="text-ash">Bundle discount</dt>
                  <dd className="font-mono text-acid">
                    &minus; <Money value={totals.discount} />
                  </dd>
                </div>
              ) : null}
              <div className="flex justify-between text-sm">
                <dt className="text-ash">Shipping</dt>
                <dd className="font-mono text-acid">FREE</dd>
              </div>
              {totals.codFee > 0 ? (
                <div className="flex justify-between text-sm">
                  <dt className="text-ash">COD handling</dt>
                  <dd className="font-mono text-bone">
                    <Money value={totals.codFee} />
                  </dd>
                </div>
              ) : null}
            </dl>

            <div className="flex items-baseline justify-between pt-5">
              <span className="text-[15px] font-semibold text-bone">Total</span>
              <Money value={totals.total} className="font-display text-[38px] text-bone" />
            </div>

            <p className="mt-3 text-[12px] leading-[1.5] text-dim">
              Codes and prices are re-checked on the server when you pay.
            </p>
          </div>

          <ul className="flex flex-col gap-3 rounded-tile border border-white/[0.08] bg-carbon p-5">
            {PROMISES.map(({ Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <Icon className="size-4 shrink-0 text-acid" strokeWidth={1.8} />
                <span className="text-[13.5px] text-ash">{text}</span>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </form>
  )
}
