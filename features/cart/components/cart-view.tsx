"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowLeft, ArrowRight, Minus, Plus, ShieldCheck, Tag, Trash2 } from "lucide-react"

import { Money } from "@/components/shared/money"
import { Badge } from "@/components/ui/badge"
import { Button, ButtonLink } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AddToCartButton } from "@/features/cart/components/add-to-cart-button"
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
                    ? "flex size-6.5 items-center justify-center rounded-full bg-blaze font-mono text-xs font-bold text-void"
                    : "flex size-6.5 items-center justify-center rounded-full border border-white/20 font-mono text-xs text-dim"
                }
              >
                {n}
              </span>
              <span
                className={
                  active
                    ? "hidden text-[13.5px] font-semibold tracking-[0.04em] text-bone uppercase sm:inline"
                    : "hidden text-[13.5px] tracking-[0.04em] text-dim uppercase sm:inline"
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
        <Image src="/product/hero-skull.jpg" alt="" fill sizes="160px" className="screen object-cover" />
      </div>
      <h1 className="mb-4 font-display text-[44px] leading-[1.0] text-bone uppercase sm:text-[60px]">
        Nothing in here
      </h1>
      <p className="mb-8 max-w-[400px] text-[15.5px] leading-[1.6] text-ash">
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
          <div className="mb-3.5 font-mono text-[11.5px] tracking-[0.22em] text-ember uppercase">
            Step 01 of 03
          </div>
          <h1 className="font-display text-[48px] leading-[1.0] text-bone uppercase sm:text-[64px] xl:text-[76px]">
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
              className="flex gap-4 rounded-card border border-white/[0.09] bg-carbon p-4 sm:gap-6 sm:p-6"
            >
              <div className="relative size-22 shrink-0 overflow-hidden rounded-xl bg-void sm:size-32">
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
                  <h2 className="text-[15px] leading-tight font-bold text-bone sm:text-[19px]">
                    {line.productName}
                  </h2>
                  <button
                    type="button"
                    onClick={() => remove(line.id)}
                    aria-label={`Remove ${line.colourwayName}`}
                    className="-mt-1 -mr-1 flex size-9 shrink-0 items-center justify-center text-dim transition-colors hover:text-magenta"
                  >
                    <Trash2 className="size-[17px]" strokeWidth={1.9} />
                  </button>
                </div>

                <div className="mt-1.5 mb-auto flex items-center gap-2 font-mono text-[10px] tracking-[0.1em] text-dim sm:text-[11.5px]">
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
                      className="flex size-8 items-center justify-center rounded-full text-bone"
                    >
                      <Minus className="size-3.5" strokeWidth={2.2} />
                    </button>
                    <span className="min-w-6 text-center font-mono text-sm font-bold text-bone">
                      {line.qty}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQty(line.id, line.qty + 1)}
                      aria-label="Increase quantity"
                      className="flex size-8 items-center justify-center rounded-full text-bone"
                    >
                      <Plus className="size-3.5" strokeWidth={2.2} />
                    </button>
                  </div>

                  <div className="text-right">
                    <Money
                      value={Number(line.unitPrice) * line.qty}
                      className="font-display leading-[1.08] text-[24px] text-bone sm:text-[30px]"
                    />
                    <div className="mt-0.5 font-mono text-[11px] text-dim">
                      <Money value={line.unitPrice} /> each
                    </div>
                  </div>
                </div>
              </div>
            </article>
          ))}

          {/* Upsell: only offers a colourway that isn't already in the cart */}
          {missing[0] ? (
            <div className="flex items-center gap-4 rounded-card border border-dashed border-acid/35 bg-[linear-gradient(110deg,rgb(212_255_61_/_0.07),transparent_62%)] p-4 sm:p-6">
              <div className="relative size-13 shrink-0 overflow-hidden rounded-xl bg-void sm:size-16">
                <Image
                  src={missing[0].image}
                  alt=""
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-1 font-mono text-[9.5px] tracking-[0.16em] text-acid uppercase">
                  Complete the set
                </div>
                <div className="text-[13.5px] leading-snug font-semibold text-bone sm:text-[15.5px]">
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
            href="/shop"
            className="mt-2 inline-flex items-center gap-2.5 text-sm text-dim transition-colors hover:text-bone"
          >
            <ArrowLeft className="size-4" strokeWidth={2} />
            Continue shopping
          </Link>
        </div>

        {/* ── Summary ───────────────────────────────────────── */}
        <aside className="flex flex-col gap-4">
          <div className="rounded-card border border-white/10 bg-carbon p-6 sm:p-7">
            <h2 className="mb-6 font-display leading-[1.08] text-[24px] text-bone uppercase sm:text-[26px]">
              Order summary
            </h2>

            <form
              className="mb-6 flex h-13 items-center gap-2.5 rounded-xl border border-white/[0.12] bg-void px-4"
              onSubmit={(e) => e.preventDefault()}
            >
              <Tag className="size-4 shrink-0 text-ember" strokeWidth={1.8} />
              <Input
                placeholder="Discount code"
                aria-label="Discount code"
                className="h-auto border-0 bg-transparent px-0 font-mono text-[13px] tracking-[0.08em] focus:ring-0"
              />
              <button
                type="submit"
                className="shrink-0 font-mono text-[11.5px] font-bold tracking-[0.12em] text-acid"
              >
                APPLY
              </button>
            </form>

            <dl className="flex flex-col gap-3.5 border-b border-white/10 pb-5">
              <div className="flex justify-between text-[14.5px]">
                <dt className="text-ash">Subtotal ({totals.itemCount} items)</dt>
                <dd className="font-mono text-bone">
                  <Money value={totals.subtotal} />
                </dd>
              </div>
              {totals.discount > 0 ? (
                <div className="flex justify-between text-[14.5px]">
                  <dt className="text-ash">Bundle discount</dt>
                  <dd className="font-mono text-acid">
                    − <Money value={totals.discount} />
                  </dd>
                </div>
              ) : null}
              <div className="flex justify-between text-[14.5px]">
                <dt className="text-ash">Shipping</dt>
                <dd className="font-mono text-acid">FREE</dd>
              </div>
            </dl>

            <div className="flex items-baseline justify-between py-5">
              <span className="text-[15px] font-semibold text-bone">Total</span>
              <Money value={totals.total} className="font-display leading-[1.04] text-[36px] text-bone sm:text-[40px]" />
            </div>

            <Button variant="primary" size="lg" full>
              Checkout
              <ArrowRight className="size-4" strokeWidth={2.4} />
            </Button>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-4 font-mono text-[10.5px] tracking-[0.12em] text-dim">
              <span>UPI</span>
              <span aria-hidden>·</span>
              <span>CARDS</span>
              <span aria-hidden>·</span>
              <span>NETBANKING</span>
              <span aria-hidden>·</span>
              <span>COD</span>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-tile border border-white/[0.08] bg-carbon p-5">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-acid" strokeWidth={1.7} />
            <p className="text-[13.5px] leading-[1.5] text-ash">
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
