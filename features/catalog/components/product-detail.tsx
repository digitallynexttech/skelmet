"use client"

import * as React from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import {
  Check,
  CreditCard,
  Minus,
  Package,
  Plus,
  ShieldCheck,
  Truck,
} from "lucide-react"

import { Money } from "@/components/shared/money"
import { Stars } from "@/components/shared/stars"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useCart } from "@/features/cart/hooks/use-cart"
import { PincodeCheck } from "@/features/catalog/components/pincode-check"
import type { Product } from "@/features/catalog/catalog"
import { discountPercent } from "@/lib/money"
import { cn } from "@/lib/utils"

const TRUST = [
  { Icon: ShieldCheck, label: "7-day returns" },
  { Icon: Truck, label: "Ships in 48 hrs" },
  { Icon: Package, label: "Made in India" },
  { Icon: CreditCard, label: "UPI · Card · Netbanking" },
]

const MAX_QTY = 9

export function ProductDetail({
  product,
  initialColourway,
}: {
  product: Product
  /** From `?colour=` - a lineup card opens this page on the colour clicked. */
  initialColourway?: string
}) {
  // Validated against the catalogue rather than trusted: ?colour=anything
  // would otherwise leave the page with no selection and no gallery image.
  const [colourwayId, setColourwayId] = React.useState(
    product.colourways.find((c) => c.id === initialColourway)?.id ?? product.colourways[0]!.id,
  )

  // ?colour= is applied after mount rather than read on the server. Reading it
  // server-side made the whole route dynamic and uncacheable; useSearchParams()
  // would do the same by forcing a Suspense boundary. This runs once, only
  // acts on a colourway that exists, and leaves a direct visit untouched.
  React.useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("colour")
    if (!wanted) return
    const match = product.colourways.find((c) => c.id === wanted)
    // set-state-in-effect is the right call almost everywhere, but not here:
    // window.location is not available on the server, so deriving this during
    // render would make the client's first paint disagree with the server HTML
    // and trip a hydration mismatch. After mount is the only correct moment.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (match) setColourwayId(match.id)
  }, [product.colourways])
  const [qty, setQty] = React.useState(1)
  const [shot, setShot] = React.useState(0)
  const add = useCart((s) => s.add)
  const router = useRouter()

  const colourway = product.colourways.find((c) => c.id === colourwayId) ?? product.colourways[0]!

  // Every slot follows the swatch, not just the first. It used to swap the
  // front shot alone and keep four shared "context" shots, which meant picking
  // Militia Olive showed one olive skull and then four orange ones.
  const gallery = React.useMemo(
    () =>
      product.gallery.map((shot) => ({
        src: shot.src[colourway.id],
        alt: `${colourway.name} — ${shot.alt}`,
      })),
    [colourway, product.gallery],
  )
  const active = gallery[Math.min(shot, gallery.length - 1)]!

  const lineTotal = Number(colourway.price) * qty

  return (
    <div id="buy" className="grid gap-8 px-5 py-8 sm:px-8 lg:grid-cols-[minmax(0,calc(100dvh-19rem))_minmax(0,1fr)] lg:gap-14 lg:py-10 xl:px-14">
      {/* ── Gallery ───────────────────────────────────────────── */}
      <div className="flex flex-col gap-3.5">
        {/* Fills its column. It used to be capped to a square the height of
            the viewport, which on any wide screen left the image narrower than
            the space it sat in - centred, with dead air down both sides.

            Still square, because the colourway shots are 1:1 and a 4:5 box was
            scaling them up 25% and cutting the sides off. */}
        <div className="grain rounded-card bg-carbon relative aspect-square w-full overflow-hidden border border-white/[0.08]">
          <Image
            key={active.src}
            src={active.src}
            alt={active.alt}
            fill
            priority
            sizes="(min-width: 1024px) 55vw, 92vw"
            className="object-cover"
          />
          <div className="absolute top-4 left-4 flex flex-wrap gap-2">
            {colourway.inStock ? <Badge variant="solid">In stock</Badge> : null}
          </div>
        </div>

        {/* Fixed height rather than aspect-square: at this column width square
            thumbs are ~160px tall and push the gallery past the fold. */}
        <div className="grid w-full grid-cols-5 gap-2.5">
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
            {colourway.stock} left in this colourway
          </div>
          <h1 className="font-display text-bone mb-3 text-[38px] leading-[1.04] uppercase sm:text-[46px] lg:text-[40px] xl:text-[54px]">
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
              value={colourway.price}
              className="font-display text-bone text-[38px] leading-[1.04] sm:text-[46px]"
            />
            <Money value={product.compareAtPrice} strike className="text-[17px]" />
            <Badge variant="solid">
              Save {discountPercent(product.compareAtPrice, colourway.price)}%
            </Badge>
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

        {/* qty + add + buy. One row from xl, stacked below it. */}
        <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap xl:flex-nowrap xl:max-w-[720px]">
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
            className="min-w-0 flex-1"
            onClick={() => add(colourwayId, qty)}
          >
            Add to cart · <Money value={lineTotal} />
          </Button>

          <Button
            variant="accent"
            size="lg"
            full
            className="min-w-0 flex-1"
            onClick={() => {
              // Add first, then navigate: checkout reads the cart on mount, and
              // arriving before the write lands shows the empty state.
              add(colourwayId, qty)
              router.push("/checkout")
            }}
          >
            Buy it now
          </Button>
        </div>

        {/* pincode */}
        <PincodeCheck />

        {/* trust */}
        <div className="grid grid-cols-2 gap-2.5">
          {TRUST.map(({ Icon, label }) => (
            <div
              key={label}
              className="bg-carbon flex items-center gap-2.5 rounded-xl border border-white/[0.08] p-3.5"
            >
              <Icon className="text-ember size-4 shrink-0" strokeWidth={1.7} />
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
                <Check className="text-ember size-4 shrink-0" strokeWidth={2.4} />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
