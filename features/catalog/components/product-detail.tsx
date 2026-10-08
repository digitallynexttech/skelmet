"use client"

import * as React from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import {
  Check,
  ChevronLeft,
  ChevronRight,
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
import { useCartDrawer } from "@/features/cart/hooks/use-cart-drawer"
import { buyNowHref, useBuySelection } from "@/features/catalog/hooks/use-buy-selection"
import { PincodeCheck } from "@/features/catalog/components/pincode-check"
import type { Product } from "@/features/catalog/catalog"
import { siteConfig } from "@/config/site"
import { discountPercent } from "@/lib/money"
import { cn } from "@/lib/utils"

const TRUST = [
  { Icon: ShieldCheck, label: "7-day returns" },
  { Icon: Truck, label: "Ships in 48 hours" },
  { Icon: Package, label: "Made in India" },
  { Icon: CreditCard, label: "UPI · Cards · Netbanking" },
]

const MAX_QTY = 9

export function ProductDetail({
  product,
  freeShipping,
  initialColourway,
  showSpecs = false,
}: {
  product: Product
  /** No shipping charge anywhere (Settings > Shipping charge at 0%). */
  freeShipping: boolean
  /**
   * The specs in the panel, for a page without the Flame Skull's build
   * section (anatomy.tsx), which lists them there.
   */
  showSpecs?: boolean
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
  // Shared with the phone's sticky bar, so its Buy now buys - and its price
  // quotes - what is picked here.
  const setSelection = useBuySelection((s) => s.set)
  const pickedPrice = product.colourways.find((c) => c.id === colourwayId)?.price ?? product.price
  React.useEffect(
    () => setSelection(colourwayId, qty, pickedPrice, freeShipping),
    [colourwayId, qty, pickedPrice, freeShipping, setSelection],
  )
  const [shot, setShot] = React.useState(0)
  const add = useCart((s) => s.add)
  const showCart = useCartDrawer((s) => s.show)
  const router = useRouter()

  const colourway = product.colourways.find((c) => c.id === colourwayId) ?? product.colourways[0]!

  // Each finish has its own pictures, so the whole gallery follows the swatch.
  // It used to swap the front shot alone and keep four shared "context" shots,
  // which meant picking Militia Olive showed one olive skull and then four
  // orange ones.
  const gallery = React.useMemo(
    () =>
      product.gallery[colourway.id].map((image) => ({
        ...image,
        alt: `${colourway.name} — ${image.alt}`,
      })),
    [colourway, product.gallery],
  )
  const active = gallery[Math.min(shot, gallery.length - 1)]!

  // The thumbnail row shows five at a time and scrolls within itself; the
  // arrows step it one thumbnail at a time and fade out at either end.
  const thumbs = React.useRef<HTMLDivElement>(null)
  const [canScroll, setCanScroll] = React.useState({ back: false, forward: false })
  const measureThumbs = React.useCallback(() => {
    const el = thumbs.current
    if (!el) return
    setCanScroll({
      back: el.scrollLeft > 1,
      forward: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
    })
  }, [])
  React.useEffect(() => {
    measureThumbs()
    window.addEventListener("resize", measureThumbs)
    return () => window.removeEventListener("resize", measureThumbs)
  }, [measureThumbs, gallery.length])
  const stepThumbs = (direction: 1 | -1) => {
    const el = thumbs.current
    const first = el?.firstElementChild as HTMLElement | null
    if (!el || !first) return
    const gap = parseFloat(getComputedStyle(el).columnGap) || 0
    el.scrollBy({ left: direction * (first.offsetWidth + gap), behavior: "smooth" })
  }
  // The picked shot stays in view: a new colourway goes back to the first.
  React.useEffect(() => {
    const el = thumbs.current
    const thumb = el?.children[shot] as HTMLElement | undefined
    if (!el || !thumb) return
    if (thumb.offsetLeft < el.scrollLeft) {
      el.scrollTo({ left: thumb.offsetLeft, behavior: "smooth" })
    } else if (thumb.offsetLeft + thumb.offsetWidth > el.scrollLeft + el.clientWidth) {
      el.scrollTo({
        left: thumb.offsetLeft + thumb.offsetWidth - el.clientWidth,
        behavior: "smooth",
      })
    }
  }, [shot])

  const lineTotal = Number(colourway.price) * qty
  // Checkout refuses a sold-out colourway anyway; say so before anyone tries.
  const soldOut = !colourway.inStock

  // "Added to cart" on the button for a moment after a tap.
  const [added, setAdded] = React.useState(false)
  React.useEffect(() => {
    if (!added) return
    const timer = window.setTimeout(() => setAdded(false), 1800)
    return () => window.clearTimeout(timer)
  }, [added])

  return (
    <div
      id="buy"
      className="grid grid-cols-1 gap-8 px-5 py-8 sm:px-8 lg:grid-cols-[minmax(0,calc(100dvh-19rem))_minmax(0,1fr)] lg:gap-14 lg:py-10 xl:px-14"
    >
      {/* ── Gallery ───────────────────────────────────────────── */}
      <div className="flex flex-col gap-3.5">
        {/* Fills its column. It used to be capped to a square the height of
            the viewport, which on any wide screen left the image narrower than
            the space it sat in - centred, with dead air down both sides.

            Still square, because the colourway shots are 1:1 and a 4:5 box was
            scaling them up 25% and cutting the sides off. */}
        <div className="grain rounded-card bg-carbon relative aspect-square w-full overflow-hidden border border-white/[0.08]">
          {/* The page's main image: preloaded and first in the queue. Its
              column is capped at the viewport height less the header and buy
              row on desktop, so it is never 55vw wide there - sizes says so,
              or desktop downloads 2-4x the pixels it shows. */}
          <Image
            key={active.src}
            src={active.src}
            alt={active.alt}
            fill
            preload
            fetchPriority="high"
            sizes="(min-width: 1024px) min(55vw, calc(100vh - 19rem)), 92vw"
            className="object-cover"
          />
          <div className="absolute top-4 left-4 flex flex-wrap gap-2">
            {colourway.inStock ? <Badge variant="solid">In stock</Badge> : null}
          </div>
          {/* A use-case shot says what it shows. */}
          {active.caption ? (
            <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(0deg,rgb(7_6_10_/_0.92)_0%,rgb(7_6_10_/_0.7)_45%,rgb(7_6_10_/_0)_100%)] px-5 pt-16 pb-5 sm:px-7 sm:pb-6">
              <p className="font-display text-bone text-[22px] leading-[1.1] uppercase sm:text-[28px]">
                {active.caption.title}
              </p>
              <p className="text-ash mt-1.5 max-w-[460px] text-[14px] leading-[1.55] sm:text-[15px]">
                {active.caption.body}
              </p>
            </div>
          ) : null}
        </div>

        {/* Five thumbnails at a time from sm, three on a phone - five there
            came out about 40px, too small to make out - arrows either side.
            The row scrolls
            within itself - never the page - with its scrollbar hidden; the
            arrows are the way along it. Fixed height rather than square: at
            this column width square thumbs push the gallery past the fold. */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => stepThumbs(-1)}
            disabled={!canScroll.back}
            aria-label="Previous pictures"
            className="text-bone hover:border-blaze grid size-9 shrink-0 place-items-center rounded-full border border-white/15 transition-colors disabled:pointer-events-none disabled:opacity-30"
          >
            <ChevronLeft className="size-4" strokeWidth={2} aria-hidden />
          </button>
          <div
            ref={thumbs}
            onScroll={measureThumbs}
            className="flex min-w-0 flex-1 snap-x [scrollbar-width:none] gap-2 overflow-x-auto sm:gap-2.5 [&::-webkit-scrollbar]:hidden"
          >
            {gallery.map((g, i) => (
              <button
                key={g.src + i}
                type="button"
                onClick={() => setShot(i)}
                aria-label={`View ${g.alt}`}
                aria-current={i === shot}
                className={cn(
                  "relative aspect-square max-h-[84px] w-[calc((100%-1rem)/3)] shrink-0 snap-start overflow-hidden rounded-xl border transition-colors sm:w-[calc((100%-2.5rem)/5)]",
                  i === shot ? "border-blaze" : "border-white/10 hover:border-white/25",
                )}
              >
                <Image src={g.src} alt="" fill sizes="120px" className="object-cover" />
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => stepThumbs(1)}
            disabled={!canScroll.forward}
            aria-label="More pictures"
            className="text-bone hover:border-blaze grid size-9 shrink-0 place-items-center rounded-full border border-white/15 transition-colors disabled:pointer-events-none disabled:opacity-30"
          >
            <ChevronRight className="size-4" strokeWidth={2} aria-hidden />
          </button>
        </div>
      </div>

      {/* ── Buy panel ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-5">
        <div>
          {/* The count only when it is a real number: with no database the
              registry has no stock figure, and "0 left" beside "In stock" was
              both. */}
          {!colourway.inStock ? (
            <div className="text-magenta mb-3.5 font-mono text-[11px] tracking-[0.18em] uppercase">
              Sold out in this colourway
            </div>
          ) : colourway.stock > 0 ? (
            <div className="text-acid mb-3.5 flex items-center gap-2.5 font-mono text-[11px] tracking-[0.18em] uppercase">
              <span className="animate-blink bg-acid size-1.5 rounded-full" />
              {colourway.stock} left in this colourway
            </div>
          ) : null}
          <h1 className="font-display text-bone mb-3 text-[38px] leading-[1.04] uppercase sm:text-[46px] lg:text-[40px] xl:text-[54px]">
            {product.name}
          </h1>
          <div className="text-dim flex flex-wrap items-center gap-x-3.5 gap-y-1.5 font-mono text-[11px] tracking-[0.08em] sm:text-xs">
            {/* No stars for a product nobody has reviewed yet, rather than five empty ones. */}
            {product.reviewCount > 0 ? (
              <>
                <Stars rating={product.rating} />
                <span className="text-bone">{product.rating}</span>
                <span>{product.reviewCount} REVIEWS</span>
                <span aria-hidden className="hidden h-3 w-px bg-white/15 sm:block" />
              </>
            ) : null}
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
            Inclusive of all taxes · {freeShipping ? "Free shipping" : "Shipping by pincode"}
          </p>
        </div>

        {/* colourway */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <span className="text-dim font-mono text-[11px] tracking-[0.14em] uppercase">
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
                  {/* The skull's 3D model in this colourway. For the plain colour
                      circle instead, comment this span out and uncomment the one
                      below it. */}
                  <span className="relative block size-14">
                    <Image src={c.swatch} alt="" fill sizes="56px" className="object-contain" />
                  </span>
                  {/* <span className="block size-8 rounded-full" style={{ backgroundColor: c.hex }} /> */}
                </button>
              )
            })}
          </div>
        </div>

        {/* qty + add + buy, sized by the row's own width (a container query):
            the buy panel's column depends on the screen's height as well as
            its width, so no screen breakpoint says how much room there is.
            From 40rem all three share one row. Narrower, the stepper and Add
            to cart share the first and Buy it now takes the second; under
            24rem the price leaves Add to cart's label, which needs 234px with
            it and 161px without. Add to cart keeps a 150px floor, so on the
            narrowest phones it wraps onto a row of its own instead. */}
        <div className="@container flex flex-wrap gap-2.5 xl:max-w-[720px]">
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
            className="min-w-[150px] flex-1 @max-[24rem]:px-5"
            disabled={soldOut}
            onClick={(e) => {
              add(colourwayId, qty, product.slug)
              // The header's count was the only sign anything happened, and on
              // a phone it is easy to miss. The cart opens with the mount in it.
              setAdded(true)
              showCart(e.currentTarget)
            }}
          >
            {soldOut ? (
              "Sold out"
            ) : added ? (
              <span className="inline-flex items-center gap-2">
                <Check className="size-4" strokeWidth={2.6} />
                Added to cart
              </span>
            ) : (
              <>
                {/* The price leaves the label where the row is too narrow for
                    it; it is right above, in large. */}
                <span>
                  Add to cart<span className="@max-[24rem]:hidden"> ·</span>
                </span>
                <Money value={lineTotal} className="@max-[24rem]:hidden" />
              </>
            )}
          </Button>

          <Button
            variant="accent"
            size="lg"
            className="min-w-0 grow basis-full @min-[40rem]:basis-0"
            disabled={soldOut}
            onClick={() =>
              // Straight to checkout with just this, leaving the cart as it is.
              router.push(buyNowHref(colourwayId, qty, product.slug))
            }
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
              <Icon className="text-acid size-4 shrink-0" strokeWidth={1.7} />
              <span className="text-bone text-[12.5px]">{label}</span>
            </div>
          ))}
        </div>

        {/* in the box */}
        <div className="rounded-tile bg-carbon border border-white/[0.09] p-5">
          <div className="text-dim mb-3.5 font-mono text-[11px] tracking-[0.14em] uppercase">
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

        {showSpecs ? (
          <div className="rounded-tile bg-carbon border border-white/[0.09] p-5">
            <div className="text-dim mb-3.5 font-mono text-[11px] tracking-[0.14em] uppercase">
              Specs
            </div>
            <dl className="flex flex-col">
              {product.specs.map((spec) => (
                <div
                  key={spec.label}
                  className="flex items-center justify-between gap-4 border-b border-white/[0.07] py-2.5 text-[13.5px] last:border-b-0"
                >
                  <dt className="text-dim">{spec.label}</dt>
                  <dd className={cn("text-right", spec.pending ? "text-ember" : "text-bone")}>
                    {spec.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}

        {/* The declarations the Legal Metrology (Packaged Commodities) Rules
            require of an online listing, in one place. Collapsed, because a
            buyer rarely needs them - but always in the page. The maker is
            named without its address, the owner's call on 2026-10-01; the
            rules ask for the address too, and it is on /contact and in the
            policies. */}
        <details className="group rounded-tile bg-carbon border border-white/[0.09] px-5 py-4">
          <summary className="text-dim flex min-h-8 cursor-pointer list-none items-center justify-between font-mono text-[11px] tracking-[0.18em] uppercase">
            Product information
            <Plus
              className="size-4 transition-transform group-open:rotate-45"
              strokeWidth={2}
              aria-hidden
            />
          </summary>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[13px]">
            {[
              ["Product", product.productType],
              ["Net quantity", "1 unit: the mount and its wall fixings"],
              [
                "MRP",
                <>
                  <Money value={product.compareAtPrice} /> (inclusive of all taxes)
                </>,
              ],
              ["Country of origin", "India"],
              ["Manufactured and packed by", siteConfig.legalEntity],
              ["Consumer care", `${siteConfig.supportEmail} · ${siteConfig.phone}`],
            ].map(([label, value]) => (
              <React.Fragment key={String(label)}>
                <dt className="text-dim">{label}</dt>
                <dd className="text-ash">{value}</dd>
              </React.Fragment>
            ))}
          </dl>
        </details>
      </div>
    </div>
  )
}
