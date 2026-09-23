"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowLeft, ArrowRight, Minus, Plus, ShieldCheck, Trash2 } from "lucide-react"

import { Money } from "@/components/shared/money"
import { Badge } from "@/components/ui/badge"
import { ButtonLink } from "@/components/ui/button"
import { AddToCartButton } from "@/features/cart/components/add-to-cart-button"
import { CouponBox, type AppliedCoupon } from "@/features/cart/components/coupon-box"
import { calculateTotals, useCart } from "@/features/cart/hooks/use-cart"
import { COLOURWAYS, FLAME_SKULL_MOUNT } from "@/features/catalog/catalog"
import { useHydrated } from "@/hooks/use-hydrated"

function Steps({ current }: { current: 1 | 2 | 3 }) {
  const steps = ["Cart", "Details", "Payment"] as const
  return (
    <div className="flex items-center gap-2.5 sm:gap-4">
      {steps.map((label, i) => {
        const n = (i + 1) as 1 | 2 | 3
        const active = n === current
        return (
          <React.Fragment key={label}>
            {i > 0 ? <span className="h-px flex-1 bg-white/15 sm:w-11 sm:flex-none" /> : null}
            <div className="flex items-center gap-2.5">
              <span
                className={
                  active
                    ? "bg-blaze text-void flex size-6.5 items-center justify-center rounded-full font-mono text-xs font-bold"
                    : "text-dim flex size-6.5 items-center justify-center rounded-full border border-white/20 font-mono text-xs"
                }
              >
                {n}
              </span>
              <span
                className={
                  active
                    ? "text-bone hidden text-[13.5px] font-semibold tracking-[0.04em] uppercase sm:inline"
                    : "text-dim hidden text-[13.5px] tracking-[0.04em] uppercase sm:inline"
                }
              >
                {label}
              </span>
            </div>
          </React.Fragment>
        )
      })}
    </div>
  )
}

function EmptyCart() {
  return (
    <div className="flex flex-col items-center px-5 py-24 text-center">
      <div className="relative mb-8 size-40 opacity-70">
        <Image
          src="/product/hero-skull.jpg"
          alt=""
          fill
          sizes="160px"
          className="screen object-cover"
        />
      </div>
      <h1 className="font-display text-bone mb-4 text-[44px] leading-[1.0] uppercase sm:text-[60px]">
        Nothing in here
      </h1>
      <p className="text-ash mb-8 max-w-[400px] text-[15.5px] leading-[1.6]">
        Your cart is as empty as the wall above your desk. Let&apos;s fix one of those.
      </p>
      <ButtonLink href={`/product/${FLAME_SKULL_MOUNT.slug}`} variant="primary" size="lg">
        Shop the mount
        <ArrowRight className="size-4" strokeWidth={2.4} />
      </ButtonLink>
    </div>
  )
}

export function CartView() {
  const items = useCart((s) => s.items)
  const setQty = useCart((s) => s.setQty)
  const remove = useCart((s) => s.remove)

  // Persisted store: render nothing decision-shaped until it has rehydrated.
  const mounted = useHydrated()

  const totals = calculateTotals(items)
  const [coupon, setCouponApplied] = React.useState<AppliedCoupon | null>(null)
  const missing = COLOURWAYS.filter((c) => !items.some((line) => line.colourway === c.id))

  if (!mounted) {
    return <div className="min-h-[60vh]" aria-hidden />
  }

  if (items.length === 0) {
    return <EmptyCart />
  }

  return (
    <div className="px-5 pb-24 sm:px-8 xl:px-14">
      <div className="flex flex-col gap-6 py-10 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-ember mb-3.5 font-mono text-[11.5px] tracking-[0.22em] uppercase">
            Step 01 of 03
          </div>
          <h1 className="font-display text-bone text-[48px] leading-[1.0] uppercase sm:text-[64px] xl:text-[76px]">
            Your stash
          </h1>
        </div>
        <Steps current={1} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        {/* ── Lines ─────────────────────────────────────────── */}
        <div className="flex flex-col gap-3.5">
          {items.map((line) => (
            <article
              key={line.id}
              className="rounded-card bg-carbon flex gap-4 border border-white/[0.09] p-4 sm:gap-6 sm:p-6"
            >
              <div className="bg-void relative size-22 shrink-0 overflow-hidden rounded-xl sm:size-32">
                <Image
                  src={line.image}
                  alt={`${line.colourwayName} mount`}
                  fill
                  sizes="128px"
                  className="object-cover"
                />
              </div>

              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-bone text-[15px] leading-tight font-bold sm:text-[19px]">
                    {line.productName}
                  </h2>
                  <button
                    type="button"
                    onClick={() => remove(line.id)}
                    aria-label={`Remove ${line.colourwayName}`}
                    className="text-dim hover:text-magenta -mt-1 -mr-1 flex size-9 shrink-0 items-center justify-center transition-colors"
                  >
                    <Trash2 className="size-[17px]" strokeWidth={1.9} />
                  </button>
                </div>

                <div className="text-dim mt-1.5 mb-auto flex items-center gap-2 font-mono text-[10px] tracking-[0.1em] sm:text-[11.5px]">
                  <span
                    className="size-2.5 rounded-full"
                    style={{
                      backgroundColor:
                        COLOURWAYS.find((c) => c.id === line.colourway)?.hex ?? "#FF5A1F",
                    }}
                  />
                  {line.colourwayName.toUpperCase()} · {line.sku}
                </div>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <div className="flex h-10 items-center gap-0.5 rounded-full border border-white/[0.16] px-1.5">
                    <button
                      type="button"
                      onClick={() => setQty(line.id, line.qty - 1)}
                      aria-label="Decrease quantity"
                      className="text-bone flex size-8 items-center justify-center rounded-full"
                    >
                      <Minus className="size-3.5" strokeWidth={2.2} />
                    </button>
                    <span className="text-bone min-w-6 text-center font-mono text-sm font-bold">
                      {line.qty}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQty(line.id, line.qty + 1)}
                      aria-label="Increase quantity"
                      className="text-bone flex size-8 items-center justify-center rounded-full"
                    >
                      <Plus className="size-3.5" strokeWidth={2.2} />
                    </button>
                  </div>

                  <div className="text-right">
                    <Money
                      value={Number(line.unitPrice) * line.qty}
                      className="font-display text-bone text-[24px] leading-[1.08] sm:text-[30px]"
                    />
                    <div className="text-dim mt-0.5 font-mono text-[11px]">
                      <Money value={line.unitPrice} /> each
                    </div>
                  </div>
                </div>
              </div>
            </article>
          ))}

          {/* Upsell: only offers a colourway that isn't already in the cart */}
          {missing[0] ? (
            <div className="rounded-card border-acid/35 flex items-center gap-4 border border-dashed bg-[linear-gradient(110deg,rgb(212_255_61_/_0.07),transparent_62%)] p-4 sm:p-6">
              <div className="bg-void relative size-13 shrink-0 overflow-hidden rounded-xl sm:size-16">
                <Image src={missing[0].image} alt="" fill sizes="64px" className="object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-acid mb-1 font-mono text-[9.5px] tracking-[0.16em] uppercase">
                  Complete the set
                </div>
                <div className="text-bone text-[13.5px] leading-snug font-semibold sm:text-[15.5px]">
                  Add {missing[0].name} and the third one is <Money value={1199} />
                </div>
              </div>
              <AddToCartButton
                colourway={missing[0].id}
                label="Add"
                variant="accent"
                size="sm"
                className="shrink-0"
              />
            </div>
          ) : null}

          <Link
            href="/product/flame-skull-mount"
            className="text-dim hover:text-bone mt-2 inline-flex items-center gap-2.5 text-sm transition-colors"
          >
            <ArrowLeft className="size-4" strokeWidth={2} />
            Continue shopping
          </Link>
        </div>

        {/* ── Summary ───────────────────────────────────────── */}
        <aside className="flex flex-col gap-4">
          <div className="rounded-card bg-carbon border border-white/10 p-6 sm:p-7">
            <h2 className="font-display text-bone mb-6 text-[24px] leading-[1.08] uppercase sm:text-[26px]">
              Order summary
            </h2>

            <CouponBox
              subtotal={totals.subtotal}
              applied={coupon}
              onApplied={setCouponApplied}
            />

            <dl className="flex flex-col gap-3.5 border-b border-white/10 pb-5">
              <div className="flex justify-between text-[14.5px]">
                <dt className="text-ash">Subtotal ({totals.itemCount} items)</dt>
                <dd className="text-bone font-mono">
                  <Money value={totals.subtotal} />
                </dd>
              </div>
              {coupon ? (
                <div className="flex justify-between text-[14.5px]">
                  <dt className="text-ash">{coupon.label}</dt>
                  <dd className="text-acid font-mono">
                    − <Money value={coupon.discount} />
                  </dd>
                </div>
              ) : null}
              {totals.discount > 0 ? (
                <div className="flex justify-between text-[14.5px]">
                  <dt className="text-ash">Bundle discount</dt>
                  <dd className="text-acid font-mono">
                    − <Money value={totals.discount} />
                  </dd>
                </div>
              ) : null}
              <div className="flex justify-between text-[14.5px]">
                <dt className="text-ash">Shipping</dt>
                <dd className="text-acid font-mono">FREE</dd>
              </div>
            </dl>

            <div className="flex items-baseline justify-between py-5">
              <span className="text-bone text-[15px] font-semibold">Total</span>
              <Money
                value={totals.total}
                className="font-display text-bone text-[36px] leading-[1.04] sm:text-[40px]"
              />
            </div>

            <ButtonLink href="/checkout" variant="primary" size="lg" full>
              Checkout
              <ArrowRight className="size-4" strokeWidth={2.4} />
            </ButtonLink>

            <div className="text-dim flex flex-wrap items-center justify-center gap-3 pt-4 font-mono text-[10.5px] tracking-[0.12em]">
              <span>UPI</span>
              <span aria-hidden>·</span>
              <span>CARDS</span>
              <span aria-hidden>·</span>
              <span>NETBANKING</span>
              <span aria-hidden>·</span>
              <span>Netbanking</span>
            </div>
          </div>

          <div className="rounded-tile bg-carbon flex items-start gap-3 border border-white/[0.08] p-5">
            <ShieldCheck className="text-acid mt-0.5 size-5 shrink-0" strokeWidth={1.7} />
            <p className="text-ash text-[13.5px] leading-[1.5]">
              Doesn&apos;t fit your wall? Send it back within 7 days, we pay the return pickup.
            </p>
          </div>

          <Badge variant="muted" className="justify-center py-2.5">
            Cart saved on this device
          </Badge>
        </aside>
      </div>
    </div>
  )
}
