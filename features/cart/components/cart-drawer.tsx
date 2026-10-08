"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
  ReceiptText,
  Tag,
  Timer,
  Trash2,
  Truck,
  X,
} from "lucide-react"

import { Money } from "@/components/shared/money"
import { siteConfig } from "@/lib/config/site"
import { ButtonLink } from "@/components/ui/button"
import {
  CouponBox,
  type AppliedCoupon,
  type CartOffer,
} from "@/features/cart/components/coupon-box"
import { calculateTotals, useCart } from "@/features/cart/hooks/use-cart"
import { useCartDrawer } from "@/features/cart/hooks/use-cart-drawer"
import { SKULL_POSTER } from "@/components/marketing/skull-interaction"
import { FLAME_SKULL_MOUNT, PRODUCTS, getProduct } from "@/features/catalog/catalog"
import { useHydrated } from "@/hooks/use-hydrated"
import { apiFetch } from "@/lib/api-fetch"
import { discountPercent } from "@/lib/money"
import { cn } from "@/lib/utils"

/** A product's MRP by slug; the Flame Skull's for an unknown slug. */
const mrpOf = (slug: string) => Number((getProduct(slug) ?? FLAME_SKULL_MOUNT).compareAtPrice)

/**
 * The cart, as a modal drawer from the right. /cart redirects to `?cart=open`
 * (next.config), which opens it. Its totals are a preview: the server prices
 * the order.
 */
export function CartDrawer() {
  const open = useCartDrawer((s) => s.open)
  const show = useCartDrawer((s) => s.show)
  const hide = useCartDrawer((s) => s.hide)
  const pathname = usePathname()
  const panel = React.useRef<HTMLDivElement>(null)

  // Contents are built on first open, or once the page is idle so the first
  // slide is smooth. Set during render: an effect would cascade (React 19).
  const [used, setUsed] = React.useState(false)
  if (open && !used) setUsed(true)
  React.useEffect(() => {
    const build = () => setUsed(true)
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(build, { timeout: 4000 })
      return () => window.cancelIdleCallback(id)
    }
    const id = window.setTimeout(build, 2500)
    return () => window.clearTimeout(id)
  }, [])

  // A change of page closes it; not the mount, which dev runs twice.
  const lastPath = React.useRef(pathname)
  React.useEffect(() => {
    if (lastPath.current === pathname) return
    lastPath.current = pathname
    hide()
  }, [pathname, hide])

  // ?cart=open (an old /cart link): open, and drop the param from the address.
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get("cart") !== "open") return
    params.delete("cart")
    const rest = params.toString()
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${rest ? `?${rest}` : ""}${window.location.hash}`,
    )
    show()
  }, [show])

  React.useEffect(() => {
    if (!open) return
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = ""
    }
  }, [open])

  React.useEffect(() => {
    if (!open) return
    const focusable = () =>
      Array.from(
        panel.current?.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), input") ??
          [],
      )
    // preventScroll: the panel is still off screen, and focus() would snap it in.
    panel.current?.querySelector<HTMLElement>("[data-first-focus]")?.focus({ preventScroll: true })

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        hide()
        return
      }
      if (e.key !== "Tab") return
      const items = focusable()
      const first = items[0]
      const last = items[items.length - 1]
      if (!first || !last) return
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("keydown", onKey)
      // Back to what opened it, if that is still on the page.
      const { opener } = useCartDrawer.getState()
      if (opener?.isConnected) opener.focus()
    }
  }, [open, hide])

  // Live prices and offers, read each time it opens.
  const syncPrices = useCart((s) => s.syncPrices)
  const [prices, setPrices] = React.useState<Record<string, string>>({})
  const [inStock, setInStock] = React.useState<string[] | null>(null)
  const [offers, setOffers] = React.useState<CartOffer[]>([])
  React.useEffect(() => {
    if (!open) return
    let cancelled = false
    void apiFetch<CartOffer[]>("/api/public/coupons/offers")
      .then((list) => {
        if (!cancelled) setOffers(list)
      })
      .catch(() => {
        // No offers to show; the code box still takes one typed in.
      })
    return () => {
      cancelled = true
    }
  }, [open])
  React.useEffect(() => {
    if (!open) return
    let cancelled = false
    void apiFetch<Record<string, string>>("/api/public/catalog/prices")
      .then((live) => {
        if (cancelled) return
        syncPrices(live)
        setPrices(live)
      })
      .catch(() => {
        // The saved prices stand; checkout prices the order again anyway.
      })
    void apiFetch<string[]>("/api/public/catalog/in-stock")
      .then((skus) => {
        if (!cancelled) setInStock(skus)
      })
      .catch(() => {
        // The registry's flags stand for the suggestions.
      })
    return () => {
      cancelled = true
    }
  }, [open, syncPrices])

  return (
    // The wrapper keeps the off-screen panel from widening the page.
    <div
      className={cn(
        // clip, not hidden: a hidden box can still be scrolled by the browser.
        "fixed inset-0 z-[70] overflow-clip",
        open ? "pointer-events-auto" : "pointer-events-none",
      )}
      inert={!open}
    >
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close cart"
        onClick={() => hide()}
        className={cn(
          "bg-void/80 absolute inset-0 transition-opacity ease-in-out",
          open ? "opacity-100 duration-[450ms]" : "opacity-0 duration-[350ms]",
        )}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label="Your cart"
        className={cn(
          // Transform only, so the compositor slides it. An even curve: a steep
          // ease-out reads as a jump.
          "bg-carbon absolute inset-y-0 right-0 flex w-full flex-col overflow-hidden border-l border-white/[0.08] shadow-[-24px_0_60px_rgb(0_0_0_/_0.45)] transition-[transform] will-change-transform sm:max-w-[440px]",
          open
            ? "[transform:translate3d(0,0,0)] duration-[450ms] ease-[cubic-bezier(0.25,0.1,0.25,1)]"
            : "[transform:translate3d(100%,0,0)] duration-[350ms] ease-[cubic-bezier(0.4,0,0.2,1)]",
        )}
      >
        {used ? (
          <CartContents prices={prices} inStock={inStock} offers={offers} onClose={() => hide()} />
        ) : null}
      </div>
    </div>
  )
}

function CartContents({
  prices,
  inStock,
  offers,
  onClose,
}: {
  /** Live prices by SKU; empty until fetched. */
  prices: Record<string, string>
  inStock: string[] | null
  offers: CartOffer[]
  onClose: () => void
}) {
  // Persisted store: nothing decision-shaped until it has been read.
  const mounted = useHydrated()
  const items = useCart((s) => s.items)
  const setQty = useCart((s) => s.setQty)
  const clear = useCart((s) => s.clear)
  // Emptying the cart asks to confirm.
  const [clearing, setClearing] = React.useState(false)

  const [coupon, setCoupon] = React.useState<AppliedCoupon | null>(null)
  const totals = calculateTotals(items, coupon?.discount ?? 0)
  const lines = mounted ? items : []
  const mrpTotal = items.reduce((sum, line) => sum + mrpOf(line.productSlug) * line.qty, 0)
  const saving = Math.max(0, mrpTotal - totals.total)

  return (
    <>
      <div className="flex h-[74px] shrink-0 items-center justify-between border-b border-white/[0.07] px-5">
        <div className="flex items-baseline gap-3">
          <h2 className="font-display text-bone text-[26px] leading-none uppercase">Your stash</h2>
          {lines.length > 0 ? (
            <span className="text-dim font-mono text-[11.5px] tracking-[0.14em] uppercase">
              {totals.itemCount} {totals.itemCount === 1 ? "item" : "items"}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          data-first-focus=""
          aria-label="Close cart"
          onClick={onClose}
          className="text-bone -mr-2 flex size-11 items-center justify-center"
        >
          <X className="size-[22px]" strokeWidth={2} />
        </button>
      </div>

      {!mounted ? null : lines.length === 0 ? (
        <div className="bg-void flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="rounded-tile bg-carbon flex flex-col items-center border border-white/[0.07] px-6 pt-7 pb-8 text-center">
            <div className="relative mb-4 aspect-[4/5] w-28 shrink-0">
              <Image src={SKULL_POSTER} alt="" fill sizes="112px" className="object-contain" />
            </div>
            <div className="font-display text-bone mb-2.5 text-[30px] leading-[1.0] uppercase">
              Nothing in here
            </div>
            <p className="text-ash mb-6 max-w-[290px] text-[14.5px] leading-[1.6]">
              Your cart is as empty as the wall above your desk. Let&apos;s fix one of those.
            </p>
            <ButtonLink href="/products" variant="primary" size="sm" onClick={onClose}>
              Shop the mounts
              <ArrowRight className="size-4" strokeWidth={2.4} />
            </ButtonLink>
          </div>
          <Recommendations inCart={[]} prices={prices} inStock={inStock} />
        </div>
      ) : (
        // All of it scrolls; the checkout bar stays at the foot.
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="bg-void flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain p-3">
            <section aria-labelledby="cart-shipment" className={cn(CARD, "p-0")}>
              <div className="flex items-center gap-3 p-4 pb-2">
                <div className="bg-void flex size-11 shrink-0 items-center justify-center rounded-xl border border-white/[0.08]">
                  <Timer className="text-ember size-5" strokeWidth={1.8} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 id="cart-shipment" className={CARD_TITLE}>
                    Ships in {siteConfig.promise.dispatchHours} hours
                  </h3>
                  <p className="text-dim mt-0.5 text-[12.5px]">
                    Shipment of {totals.itemCount} {totals.itemCount === 1 ? "item" : "items"} ·
                    delivered in {siteConfig.promise.deliveryDays}
                  </p>
                </div>
                {clearing ? (
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        clear()
                        setClearing(false)
                      }}
                      className="bg-magenta text-void rounded-full px-3 py-1.5 text-[12px] font-bold"
                    >
                      Clear all
                    </button>
                    <button
                      type="button"
                      onClick={() => setClearing(false)}
                      className="text-ash hover:text-bone rounded-full border border-white/[0.16] px-3 py-1.5 text-[12px] font-semibold"
                    >
                      Keep
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setClearing(true)}
                    aria-label="Remove everything from the cart"
                    title="Empty the cart"
                    className="text-dim hover:text-magenta -mr-1 flex size-9 shrink-0 items-center justify-center transition-colors"
                  >
                    <Trash2 className="size-[17px]" strokeWidth={1.9} />
                  </button>
                )}
              </div>

              <ul className="px-4">
                {lines.map((line) => {
                  const hex =
                    getProduct(line.productSlug)?.colourways.find((c) => c.id === line.colourway)
                      ?.hex ?? "#FF5A1F"
                  const mrp = mrpOf(line.productSlug) * line.qty
                  const price = Number(line.unitPrice) * line.qty
                  return (
                    <li
                      key={line.id}
                      className="flex items-center gap-3 border-b border-white/[0.06] py-3.5 last:border-b-0 max-[359px]:gap-2.5"
                    >
                      <div className="bg-void relative size-16 shrink-0 overflow-hidden rounded-xl border border-white/[0.06] max-[359px]:size-13">
                        <Image
                          src={line.image}
                          alt={`${line.colourwayName} mount`}
                          fill
                          sizes="64px"
                          className="object-cover"
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <h4 className="text-bone line-clamp-2 text-[14px] leading-snug font-semibold">
                          {line.productName}
                        </h4>
                        <div className="text-dim mt-0.5 flex items-center gap-1.5 font-mono text-[10.5px] tracking-[0.1em] uppercase">
                          <span
                            className="size-2 shrink-0 rounded-full"
                            style={{ backgroundColor: hex }}
                          />
                          <span className="truncate">{line.colourwayName}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-baseline gap-x-1.5">
                          <Money
                            value={price}
                            className="text-bone font-mono text-[14px] font-bold"
                          />
                          {mrp > price ? (
                            <Money value={mrp} strike className="text-[11.5px]" />
                          ) : null}
                        </div>
                      </div>

                      {/* Minus at one removes the line. */}
                      <div className="bg-blaze text-void flex h-9 shrink-0 items-center rounded-lg">
                        <button
                          type="button"
                          onClick={() => setQty(line.id, line.qty - 1)}
                          aria-label={
                            line.qty === 1 ? `Remove ${line.colourwayName}` : "Decrease quantity"
                          }
                          className="flex h-full w-8 items-center justify-center"
                        >
                          <Minus className="size-3.5" strokeWidth={2.6} />
                        </button>
                        <span className="min-w-5 text-center font-mono text-[14px] font-bold">
                          {line.qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => setQty(line.id, line.qty + 1)}
                          aria-label="Increase quantity"
                          className="flex h-full w-8 items-center justify-center"
                        >
                          <Plus className="size-3.5" strokeWidth={2.6} />
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>

              <div className="text-ash border-t border-white/[0.06] px-4 py-3.5 text-center text-[13.5px]">
                Forgot something?{" "}
                <Link
                  href="/products"
                  onClick={onClose}
                  className="text-blaze hover:text-ember font-semibold transition-colors"
                >
                  Add more items
                </Link>
              </div>
            </section>

            <section aria-labelledby="cart-offers" className={CARD}>
              <h3 id="cart-offers" className={`${CARD_TITLE} mb-3.5`}>
                Coupons &amp; offers
              </h3>
              <CouponBox
                subtotal={totals.subtotal}
                applied={coupon}
                onApplied={setCoupon}
                offers={offers}
                className=""
              />
            </section>

            <Recommendations inCart={lines.map((l) => l.sku)} prices={prices} inStock={inStock} />

            <section aria-labelledby="cart-bill" className={CARD}>
              <h3 id="cart-bill" className={`${CARD_TITLE} mb-3`}>
                Bill details
              </h3>
              <dl className="flex flex-col gap-2.5 text-[13.5px]">
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-ash flex items-center gap-2">
                    <ReceiptText className="size-4 shrink-0" strokeWidth={1.7} />
                    Items total
                  </dt>
                  <dd className="flex items-baseline gap-1.5 font-mono">
                    {mrpTotal > totals.subtotal ? (
                      <Money value={mrpTotal} strike className="text-[11.5px]" />
                    ) : null}
                    <Money value={totals.subtotal} className="text-bone" />
                  </dd>
                </div>
                {coupon && totals.couponOff > 0 ? (
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-ash flex items-center gap-2">
                      <Tag className="size-4 shrink-0" strokeWidth={1.7} />
                      {coupon.label}
                    </dt>
                    <dd className="text-acid font-mono">
                      − <Money value={totals.couponOff} />
                    </dd>
                  </div>
                ) : null}
                {/* Shipping needs the pincode, which only checkout asks for. */}
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-ash flex items-center gap-2">
                    <Truck className="size-4 shrink-0" strokeWidth={1.7} />
                    Shipping
                  </dt>
                  <dd className="text-dim text-right text-[12.5px]">By pincode, at checkout</dd>
                </div>
              </dl>
              <div className="mt-3.5 flex items-baseline justify-between gap-4 border-t border-white/[0.07] pt-3.5">
                <span className="text-bone text-[15px] font-bold">Total before shipping</span>
                <Money
                  value={totals.total}
                  className="font-display text-bone text-[26px] leading-none"
                />
              </div>
              {saving > 0 ? (
                <div className="bg-acid/[0.08] text-acid mt-3 rounded-lg px-3 py-2 text-[12.5px] font-semibold">
                  You save <Money value={saving} /> on this order
                </div>
              ) : null}
            </section>

            <section aria-labelledby="cart-policy" className={CARD}>
              <h3 id="cart-policy" className={`${CARD_TITLE} mb-1.5`}>
                Cancellation &amp; returns
              </h3>
              {/* The policies' own terms. */}
              <p className="text-ash text-[13px] leading-[1.55]">
                Cancel free any time before dispatch for a full refund. Doesn&apos;t fit your wall?
                Send it back unused and undrilled within {siteConfig.promise.returnDays} days - we
                pay the return pickup.
              </p>
            </section>
          </div>

          <div className="bg-carbon shrink-0 border-t border-white/[0.08] px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <Link
              href="/checkout"
              onClick={onClose}
              // One plain face: mixing display and mono read as two buttons.
              className="bg-blaze text-void hover:bg-ember flex min-h-[54px] items-center justify-between gap-4 rounded-xl px-4 py-2 transition-colors"
            >
              <span className="flex flex-col">
                <Money value={totals.total} className="text-[16px] leading-tight font-bold" />
                <span className="text-[11px] leading-tight font-medium uppercase opacity-80">
                  Total
                </span>
              </span>
              <span className="flex items-center gap-1 text-[15.5px] font-medium whitespace-nowrap">
                Proceed to checkout
                <ChevronRight className="size-[18px]" strokeWidth={2} />
              </span>
            </Link>
          </div>
        </div>
      )}
    </>
  )
}

const CARD = "rounded-tile bg-carbon border border-white/[0.07] p-4"
const CARD_TITLE = "text-bone text-[15px] font-bold"

/** Each card's width plus the gap, for the arrows' step. */
const CARD_STEP = 162

/** Every product's colourways on sale and not yet in the cart, as a swipeable rail. */
function Recommendations({
  inCart,
  prices,
  inStock,
}: {
  /** SKUs already in the cart. */
  inCart: string[]
  prices: Record<string, string>
  /** SKUs on sale with stock; until read, the registry's flags (a draft is never offered). */
  inStock: string[] | null
}) {
  const add = useCart((s) => s.add)
  const rail = React.useRef<HTMLDivElement>(null)
  const picks = PRODUCTS.flatMap((product) =>
    product.colourways.map((c) => ({ product, c })),
  ).filter(({ c }) => !inCart.includes(c.sku) && (inStock ? inStock.includes(c.sku) : c.inStock))
  if (picks.length === 0) return null

  const step = (direction: 1 | -1) =>
    rail.current?.scrollBy({ left: direction * CARD_STEP, behavior: "smooth" })

  return (
    <section aria-labelledby="cart-lineup" className={cn(CARD, "px-0")}>
      <div className="mb-3.5 flex items-center justify-between gap-3 px-4">
        <h3 id="cart-lineup" className={CARD_TITLE}>
          Recommended products
        </h3>
        {picks.length > 2 ? (
          <div className="hidden gap-2 [@media(hover:hover)]:flex">
            {([-1, 1] as const).map((direction) => (
              <button
                key={direction}
                type="button"
                onClick={() => step(direction)}
                aria-label={direction < 0 ? "Previous products" : "Next products"}
                className="text-bone hover:border-blaze flex size-8 items-center justify-center rounded-full border border-white/[0.16] transition-colors"
              >
                {direction < 0 ? (
                  <ChevronLeft className="size-4" strokeWidth={2} />
                ) : (
                  <ChevronRight className="size-4" strokeWidth={2} />
                )}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div
        ref={rail}
        className="flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto overscroll-x-contain px-4"
      >
        {picks.map(({ product, c }) => {
          const price = prices[c.sku] ?? c.price
          const off = discountPercent(product.compareAtPrice, price)
          return (
            <article
              key={c.sku}
              className="rounded-tile bg-void/60 flex w-[150px] shrink-0 snap-start flex-col border border-white/[0.08] p-2.5"
            >
              <div className="bg-graphite relative aspect-square overflow-hidden rounded-xl">
                <Image
                  src={c.image}
                  alt={`${product.name} in ${c.name}`}
                  fill
                  sizes="130px"
                  className="object-cover"
                />
                {off > 0 ? (
                  <span className="bg-acid text-void absolute top-2 left-2 rounded-full px-2 py-0.5 font-mono text-[10px] font-bold">
                    −{off}%
                  </span>
                ) : null}
              </div>
              <div className="text-dim mt-2.5 flex items-center gap-1.5 font-mono text-[10px] tracking-[0.1em] uppercase">
                <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: c.hex }} />
                <span className="truncate">{c.name}</span>
              </div>
              <div className="text-bone mt-1 line-clamp-2 text-[13px] leading-tight font-semibold">
                {product.name}
              </div>
              <div className="mt-1.5 mb-auto flex flex-wrap items-baseline gap-x-1.5">
                <Money value={price} className="text-bone font-mono text-[13.5px] font-bold" />
                {off > 0 ? (
                  <Money value={product.compareAtPrice} strike className="text-[11px]" />
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => add(c.id, 1, product.slug)}
                aria-label={`Add ${product.name} in ${c.name} to cart`}
                className="text-bone hover:border-blaze hover:bg-blaze hover:text-void mt-2.5 flex h-9 items-center justify-center gap-1.5 rounded-full border border-white/[0.18] font-mono text-[11px] font-bold tracking-[0.12em] transition-colors"
              >
                <Plus className="size-3.5" strokeWidth={2.4} />
                ADD
              </button>
            </article>
          )
        })}
      </div>
    </section>
  )
}
