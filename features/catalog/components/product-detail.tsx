"use client"

import * as React from "react"
import Image from "next/image"
import {
  Check,
  CreditCard,
  Minus,
  Package,
  Plus,
  RotateCcw,
  ShieldCheck,
  Truck,
} from "lucide-react"

import { Money } from "@/components/shared/money"
import { Stars } from "@/components/shared/stars"
import { Badge } from "@/components/ui/badge"
import { Button, ButtonLink } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useCart } from "@/features/cart/hooks/use-cart"
import type { Product } from "@/features/catalog/catalog"
import { cn } from "@/lib/utils"

const TRUST = [
  { Icon: ShieldCheck, label: "7-day returns" },
  { Icon: Truck, label: "Ships in 48 hrs" },
  { Icon: Package, label: "Printed to order" },
  { Icon: CreditCard, label: "UPI · Card · COD" },
]

const MAX_QTY = 9

export function ProductDetail({ product }: { product: Product }) {
  const [colourwayId, setColourwayId] = React.useState(product.colourways[0]!.id)
  const [qty, setQty] = React.useState(1)
  const [shot, setShot] = React.useState(0)
  const add = useCart((s) => s.add)

  const colourway = product.colourways.find((c) => c.id === colourwayId) ?? product.colourways[0]!

  // The first gallery slot always shows the selected colourway; the rest are
  // shared context shots.
  const gallery = React.useMemo(
    () => [
      { src: colourway.image, alt: `${colourway.name} SKELMET mount` },
      ...product.gallery.slice(1),
    ],
    [colourway, product.gallery],
  )
  const active = gallery[Math.min(shot, gallery.length - 1)]!

  const lineTotal = Number(product.price) * qty

  return (
    <div className="grid gap-8 px-5 py-8 sm:px-8 lg:grid-cols-[minmax(0,1fr)_480px] lg:gap-14 lg:py-10 xl:grid-cols-[minmax(0,1fr)_520px] xl:px-14">
      {/* ── Gallery ───────────────────────────────────────────── */}
      <div className="flex flex-col gap-3.5">
        {/* Square, and capped to the viewport so the whole buy panel is on one
            screen. The colourway shots are 1:1, so a square box shows them
            uncropped; a 4:5 box was scaling them up 25% and cutting the sides.
            max-w is tied to the same value as max-h to keep it square. */}
        <div className="grain rounded-card bg-carbon relative mx-auto aspect-square w-full overflow-hidden border border-white/[0.08] lg:max-h-[calc(100dvh-18rem)] lg:max-w-[calc(100dvh-18rem)]">
          <Image
            key={active.src}
            src={active.src}
            alt={active.alt}
            fill
            priority
            sizes="(min-width: 1024px) min(55vw, 100vh), 92vw"
            className="object-cover"
          />
          <div className="absolute top-4 left-4 flex flex-wrap gap-2">
            {colourway.inStock ? <Badge variant="solid">In stock</Badge> : null}
            <Badge variant="outline">Batch {product.batch}</Badge>
          </div>
        </div>

        {/* Fixed height rather than aspect-square: at this column width square
            thumbs are ~160px tall and push the gallery past the fold. */}
        <div className="mx-auto grid w-full grid-cols-5 gap-2.5 lg:max-w-[calc(100dvh-18rem)]">
          {gallery.map((g, i) => (
            <button
              key={g.src + i}
              type="button"
              onClick={() => setShot(i)}
              aria-label={`View ${g.alt}`}
              aria-current={i === shot}
              className={cn(
                "relative aspect-square max-h-[84px] overflow-hidden rounded-xl border transition-colors",
                i === shot ? "border-blaze" : "border-white/10 hover:border-white/25",
              )}
            >
              <Image src={g.src} alt="" fill sizes="120px" className="object-cover" />
            </button>
          ))}
        </div>
      </div>

      {/* ── Buy panel ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-5">
        <div>
          <div className="text-acid mb-3.5 flex items-center gap-2.5 font-mono text-[10px] tracking-[0.18em] uppercase">
            <span className="animate-blink bg-acid size-1.5 rounded-full" />
            {product.unitsLeft} left in this batch
          </div>
          <h1 className="font-display text-bone mb-3 text-[38px] leading-[1.04] uppercase sm:text-[46px] xl:text-[54px]">
            {product.name}
          </h1>
          <div className="text-dim flex flex-wrap items-center gap-x-3.5 gap-y-1.5 font-mono text-[11px] tracking-[0.08em] sm:text-xs">
            <Stars rating={product.rating} />
            <span className="text-bone">{product.rating}</span>
            <span>{product.reviewCount} REVIEWS</span>
            <span aria-hidden className="hidden h-3 w-px bg-white/15 sm:block" />
            <span>{colourway.sku}</span>
          </div>
        </div>

        <div>
          <div className="flex flex-wrap items-baseline gap-3">
            <Money
              value={product.price}
              className="font-display text-bone text-[38px] leading-[1.04] sm:text-[46px]"
            />
            <Money value={product.compareAtPrice} strike className="text-[17px]" />
            <Badge variant="solid">Save 25%</Badge>
          </div>
          <p className="text-dim mt-1.5 text-[12.5px]">
            Inclusive of all taxes · Free shipping pan-India
          </p>
        </div>

        {/* colourway */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <span className="text-dim font-mono text-[10px] tracking-[0.18em] uppercase">
              Colourway
            </span>
            <span className="text-bone text-[13.5px] font-semibold">{colourway.name}</span>
          </div>
          <div className="flex gap-3">
            {product.colourways.map((c) => {
              const selected = c.id === colourwayId
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setColourwayId(c.id)
                    setShot(0)
                  }}
                  aria-label={c.name}
                  aria-pressed={selected}
                  className={cn(
                    "rounded-full border p-1 transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-105",
                    selected ? "border-[1.5px]" : "border-white/15",
                  )}
                  style={
                    selected ? { borderColor: c.hex, boxShadow: `0 0 16px ${c.hex}55` } : undefined
                  }
                >
                  <span className="block size-8 rounded-full" style={{ backgroundColor: c.hex }} />
                </button>
              )
            })}
          </div>
        </div>

        {/* qty + add */}
        <div className="flex flex-col gap-2.5 sm:flex-row">
          <div className="flex h-[58px] shrink-0 items-center gap-1 rounded-full border border-white/[0.16] px-1.5">
            <button
              type="button"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              aria-label="Decrease quantity"
              disabled={qty <= 1}
              className="text-bone flex size-11 items-center justify-center rounded-full disabled:opacity-35"
            >
              <Minus className="size-4" strokeWidth={2.2} />
            </button>
            <span className="text-bone min-w-7 text-center font-mono text-base font-bold">
              {qty}
            </span>
            <button
              type="button"
              onClick={() => setQty((q) => Math.min(MAX_QTY, q + 1))}
              aria-label="Increase quantity"
              disabled={qty >= MAX_QTY}
              className="text-bone flex size-11 items-center justify-center rounded-full disabled:opacity-35"
            >
              <Plus className="size-4" strokeWidth={2.2} />
            </button>
          </div>

          <Button
            type="button"
            variant="primary"
            size="lg"
            full
            className="flex-1"
            onClick={() => add(colourwayId, qty)}
          >
            Add to cart · <Money value={lineTotal} />
          </Button>
        </div>

        <ButtonLink href="/cart" variant="ghost" size="md" full>
          Buy it now
        </ButtonLink>

        {/* pincode */}
        <div className="rounded-field bg-carbon flex h-[54px] items-center gap-2.5 border border-white/10 px-4">
          <RotateCcw className="text-ember size-[17px] shrink-0" strokeWidth={1.7} />
          <Input
            placeholder="Enter pincode"
            inputMode="numeric"
            aria-label="Delivery pincode"
            className="h-auto border-0 bg-transparent px-0 font-mono text-[13px] tracking-[0.06em] focus:ring-0"
          />
          <button
            type="button"
            className="text-acid shrink-0 font-mono text-[11px] font-bold tracking-[0.1em]"
          >
            CHECK
          </button>
        </div>

        {/* trust */}
        <div className="grid grid-cols-2 gap-2.5">
          {TRUST.map(({ Icon, label }) => (
            <div
              key={label}
              className="bg-carbon flex items-center gap-2.5 rounded-xl border border-white/[0.08] p-3.5"
            >
              <Icon className="text-acid size-4 shrink-0" strokeWidth={1.7} />
              <span className="text-bone text-[12.5px]">{label}</span>
            </div>
          ))}
        </div>

        {/* in the box */}
        <div className="rounded-tile bg-carbon border border-white/[0.09] p-5">
          <div className="text-dim mb-3.5 font-mono text-[10px] tracking-[0.18em] uppercase">
            In the box
          </div>
          <ul className="flex flex-col gap-2.5">
            {product.inTheBox.map((item) => (
              <li key={item} className="text-ash flex items-center gap-2.5 text-[14px]">
                <Check className="text-acid size-4 shrink-0" strokeWidth={2.4} />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
