"use client"

import * as React from "react"
import Image from "next/image"
import { usePathname } from "next/navigation"
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
  ShieldCheck,
  Tag,
  Trash2,
  X,
} from "lucide-react"

import { Money } from "@/components/shared/money"
import { ButtonLink } from "@/components/ui/button"
import { CouponBox, type AppliedCoupon } from "@/features/cart/components/coupon-box"
import { calculateTotals, useCart } from "@/features/cart/hooks/use-cart"
import { useCartDrawer } from "@/features/cart/hooks/use-cart-drawer"
import { SKULL_POSTER } from "@/components/marketing/skull-interaction"
import { COLOURWAYS, FLAME_SKULL_MOUNT, type ColourwayId } from "@/features/catalog/catalog"
import { useHydrated } from "@/hooks/use-hydrated"
import { apiFetch } from "@/lib/api-fetch"
import { discountPercent } from "@/lib/money"
import { cn } from "@/lib/utils"

/**
 * The cart, as a drawer from the right of whatever page the visitor is on.
 *
 * It used to be a page of its own at /cart. A drawer keeps the buyer where
 * they were: adding a mount opens it over the product page, and closing it
 * leaves them there, one tap from checkout either way. /cart still answers,
 * by sending old links and bookmarks to the home page with `?cart=open`
 * (next.config), which opens this.
 *
 * A modal sheet, as the phone menu is: focus moves in when it opens and stays
 * in, Escape and the backdrop close it, the page behind does not scroll, and
 * focus goes back to whatever opened it.
 *
 * Full width on a phone, 440px from `sm`. Inside, the lines scroll and the
 * summary stays put at the bottom - except on a screen too short to hold
 * both (a phone on its side), where the summary scrolls with the lines
 * rather than squeezing them out.
 *
 * What it shows is a preview, as the cart page's was: checkout re-reads the
 * coupon and the prices and the server charges what it works out. The prices
 * are brought up to the live ones each time the drawer opens, so the total
 * here is the one checkout starts from.
 */
export function CartDrawer() {
  const open = useCartDrawer((s) => s.open)
  const show = useCartDrawer((s) => s.show)
  const hide = useCartDrawer((s) => s.hide)
  const pathname = usePathname()
  const panel = React.useRef<HTMLDivElement>(null)

  // Nothing is rendered inside until the first time it opens: every storefront
  // page carries this component, and most visits never open it. Derived during
  // render rather than in an effect, which React 19 flags as a cascading render.
  const [used, setUsed] = React.useState(false)
  if (open && !used) setUsed(true)
  // Or once the page is idle, so the first opening slides in a panel that is
  // already built instead of building it on the frame the slide starts.
  React.useEffect(() => {
    const build = () => setUsed(true)
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(build, { timeout: 4000 })
      return () => window.cancelIdleCallback(id)
    }
    const id = window.setTimeout(build, 2500)
    return () => window.clearTimeout(id)
  }, [])

  // Any navigation closes it: Checkout, a link in the empty state, the back
  // button. Only a change of page, not the mount - which development runs
  // twice, and the second run would shut a drawer the address had just opened.
  const lastPath = React.useRef(pathname)
  React.useEffect(() => {
    if (lastPath.current === pathname) return
    lastPath.current = pathname
    hide()
  }, [pathname, hide])

  // An old /cart link arrives as ?cart=open. Open, and tidy the address so a
  // reload or a shared link is just the page.
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
    // preventScroll: the button is still off the right edge when this runs,
    // and a plain focus() scrolls the drawer's box to show it - the panel
    // snapped into place at once while its slide played on unseen.
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

  // A line keeps the price it was added at; an admin can have changed it
  // since. Read the live ones each time the drawer opens.
  const syncPrices = useCart((s) => s.syncPrices)
  const [prices, setPrices] = React.useState<Record<string, string>>({})
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
    return () => {
      cancelled = true
    }
  }, [open, syncPrices])

  return (
    // Over the header and the cookie card; the splash is over this. The
    // wrapper is what keeps the closed panel, parked off the right edge, from
    // making the page wider than the screen.
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
          // A plain transform on a layer of its own, so the compositor slides
          // it, right to left. The curve is an even one: a steep ease-out
          // covered most of the distance in the first few frames, and the
          // panel read as jumping in while the backdrop faded.
          // Rounded on its open side from sm, where it stops short of the left
          // edge; a phone's is the whole screen.
          "bg-carbon absolute inset-y-0 right-0 flex w-full flex-col overflow-hidden border-l border-white/[0.08] shadow-[-24px_0_60px_rgb(0_0_0_/_0.45)] transition-[transform] will-change-transform sm:max-w-[440px] sm:rounded-l-[28px]",
          open
            ? "[transform:translate3d(0,0,0)] duration-[450ms] ease-[cubic-bezier(0.25,0.1,0.25,1)]"
            : "[transform:translate3d(100%,0,0)] duration-[350ms] ease-[cubic-bezier(0.4,0,0.2,1)]",
        )}
      >
        {used ? <CartContents prices={prices} onClose={() => hide()} /> : null}
      </div>
    </div>
  )
}

function CartContents({
  prices,
  onClose,
}: {
  /** Live prices by SKU, once the drawer has asked; the registry's until then. */
  prices: Record<string, string>
  onClose: () => void
}) {
  // Persisted store: nothing decision-shaped until it has been read.
  const mounted = useHydrated()
  const items = useCart((s) => s.items)
  const setQty = useCart((s) => s.setQty)
  const remove = useCart((s) => s.remove)
  const couponCode = useCart((s) => s.couponCode)

  const [coupon, setCoupon] = React.useState<AppliedCoupon | null>(null)
  const [codeOpen, setCodeOpen] = React.useState(false)
  // The coupon comes off the total here as it does at checkout and on the
  // server.
  const totals = calculateTotals(items, coupon?.discount ?? 0)
  const lines = mounted ? items : []

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
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="rounded-card bg-void/60 mx-5 mt-5 flex flex-col items-center border border-white/[0.08] px-6 pt-7 pb-8 text-center">
            {/* The 3D skull's own front-facing frame, the hero's poster. */}
            <div className="relative mb-4 aspect-[4/5] w-28 shrink-0">
              <Image src={SKULL_POSTER} alt="" fill sizes="112px" className="object-contain" />
            </div>
            <div className="font-display text-bone mb-2.5 text-[30px] leading-[1.0] uppercase">
              Nothing in here
            </div>
            <p className="text-ash mb-6 max-w-[290px] text-[14.5px] leading-[1.6]">
              Your cart is as empty as the wall above your desk. Let&apos;s fix one of those.
            </p>
            <ButtonLink
              href={`/product/${FLAME_SKULL_MOUNT.slug}`}
              variant="primary"
              size="sm"
              onClick={onClose}
            >
              Shop the mount
              <ArrowRight className="size-4" strokeWidth={2.4} />
            </ButtonLink>
          </div>
          <Recommendations inCart={[]} prices={prices} />
        </div>
      ) : (
        // One scroller for the lines and the summary. The summary sticks to its
        // foot, so the lines pass under it - unless the screen is too short
        // for both, where it takes its place at the end and scrolls.
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
          <ul className="flex-1 px-5">
            {lines.map((line) => (
              <li key={line.id} className="flex gap-4 border-b border-white/[0.07] py-5">
                <div className="bg-void relative size-[76px] shrink-0 overflow-hidden rounded-xl">
                  <Image
                    src={line.image}
                    alt={`${line.colourwayName} mount`}
                    fill
                    sizes="76px"
                    className="object-cover"
                  />
                </div>

                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-bone text-[15px] leading-tight font-bold">
                      {line.productName}
                    </h3>
                    <button
                      type="button"
                      onClick={() => remove(line.id)}
                      aria-label={`Remove ${line.colourwayName}`}
                      className="text-dim hover:text-magenta -mt-2 -mr-2 flex size-9 shrink-0 items-center justify-center transition-colors"
                    >
                      <Trash2 className="size-[16px]" strokeWidth={1.9} />
                    </button>
                  </div>

                  <div className="text-dim mt-1 flex items-center gap-2 font-mono text-[11px] tracking-[0.1em]">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{
                        backgroundColor:
                          COLOURWAYS.find((c) => c.id === line.colourway)?.hex ?? "#FF5A1F",
                      }}
                    />
                    {line.colourwayName.toUpperCase()}
                  </div>

                  {/* Wraps: on the narrowest phones the stepper and a
                      five-figure total do not fit on one line. */}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                    <div className="flex h-10 items-center gap-0.5 rounded-full border border-white/[0.16] px-1">
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

                    <div className="ml-auto text-right">
                      <Money
                        value={Number(line.unitPrice) * line.qty}
                        className="font-display text-bone text-[22px] leading-[1.08]"
                      />
                      {line.qty > 1 ? (
                        <div className="text-dim mt-0.5 font-mono text-[11px]">
                          <Money value={line.unitPrice} /> each
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </li>
            ))}

            <li className="text-ash flex items-start gap-3 py-5 text-[13px] leading-[1.5]">
              <ShieldCheck className="text-acid mt-0.5 size-[18px] shrink-0" strokeWidth={1.7} />
              {/* Unused and undrilled, because a mount that has been drilled in
                  cannot come back (the returns policy). */}
              <span>
                Doesn&apos;t fit your wall? Send it back unused and undrilled within 7 days - we pay
                the return pickup.
              </span>
            </li>
          </ul>

          <Recommendations inCart={lines.map((l) => l.colourway)} prices={prices} />

          <div className="bg-carbon sticky bottom-0 shrink-0 border-t border-white/[0.08] px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] [@media(max-height:560px)]:static">
            {codeOpen || couponCode ? (
              <CouponBox
                subtotal={totals.subtotal}
                applied={coupon}
                onApplied={setCoupon}
                className="mb-4"
              />
            ) : (
              <button
                type="button"
                onClick={() => setCodeOpen(true)}
                className="text-ash hover:text-bone mb-3 flex min-h-9 items-center gap-2 text-[13.5px] transition-colors"
              >
                <Tag className="text-ember size-4" strokeWidth={1.8} />
                Have a discount code?
              </button>
            )}

            <dl className="flex flex-col gap-2 text-[14px]">
              <div className="flex justify-between gap-4">
                <dt className="text-ash">Subtotal</dt>
                <dd className="text-bone font-mono">
                  <Money value={totals.subtotal} />
                </dd>
              </div>
              {coupon && totals.couponOff > 0 ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-ash">{coupon.label}</dt>
                  <dd className="text-acid font-mono">
                    − <Money value={totals.couponOff} />
                  </dd>
                </div>
              ) : null}
              {/* Shipping depends on the delivery pincode (free, or a flat fee
                  where couriers cost more), which the cart does not have.
                  Checkout shows it as soon as the pincode is typed. */}
              <div className="flex justify-between gap-4">
                <dt className="text-ash">Shipping</dt>
                <dd className="text-dim text-right text-[13px]">By pincode, at checkout</dd>
              </div>
            </dl>

            <div className="flex items-baseline justify-between gap-4 pt-3 pb-4">
              <span className="text-bone text-[14.5px] font-semibold">Total before shipping</span>
              <Money
                value={totals.total}
                className="font-display text-bone text-[30px] leading-[1.04]"
              />
            </div>

            <ButtonLink
              href="/checkout"
              variant="primary"
              size="md"
              full
              onClick={onClose}
              className="bg-blaze bg-none shadow-none hover:shadow-none"
            >
              Checkout
              <ArrowRight className="size-4" strokeWidth={2.4} />
            </ButtonLink>

            <div className="flex items-center justify-between gap-3 pt-3">
              <button
                type="button"
                onClick={onClose}
                className="text-ash hover:text-bone flex min-h-9 items-center text-[13.5px] transition-colors"
              >
                Continue shopping
              </button>
              {/* Left off the narrowest phones, where the two do not fit on a line. */}
              <span className="text-dim font-mono text-[10.5px] tracking-[0.1em] max-[359px]:hidden">
                UPI · CARDS · NETBANKING
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/** Each card's width plus the gap, for the arrows' step. */
const CARD_STEP = 162

/**
 * "Complete the lineup": the colourways not in the cart yet, as a rail of
 * cards with their own Add button, as a bag drawer suggests what goes with
 * what is in it. There is one product, so what goes with it is its other
 * colours. Adding keeps the drawer open and puts the line straight in, and
 * the card leaves the rail; with all three in the cart the rail is gone.
 *
 * Swiped on a touch screen, with arrows where a pointer can use them.
 */
function Recommendations({
  inCart,
  prices,
}: {
  inCart: ColourwayId[]
  prices: Record<string, string>
}) {
  const add = useCart((s) => s.add)
  const rail = React.useRef<HTMLDivElement>(null)
  const picks = COLOURWAYS.filter((c) => !inCart.includes(c.id))
  if (picks.length === 0) return null

  const step = (direction: 1 | -1) =>
    rail.current?.scrollBy({ left: direction * CARD_STEP, behavior: "smooth" })

  return (
    <section aria-labelledby="cart-lineup" className="pt-6 pb-5">
      <div className="mb-3.5 flex items-center justify-between gap-3 px-5">
        <h3 id="cart-lineup" className="text-dim font-mono text-[11px] tracking-[0.22em] uppercase">
          Complete the lineup
        </h3>
        {picks.length > 2 ? (
          <div className="hidden gap-2 [@media(hover:hover)]:flex">
            {([-1, 1] as const).map((direction) => (
              <button
                key={direction}
                type="button"
                onClick={() => step(direction)}
                aria-label={direction < 0 ? "Previous colourways" : "Next colourways"}
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
        className="flex snap-x snap-mandatory scroll-px-5 gap-3 overflow-x-auto overscroll-x-contain px-5"
      >
        {picks.map((c) => {
          const price = prices[c.sku] ?? c.price
          const off = discountPercent(FLAME_SKULL_MOUNT.compareAtPrice, price)
          return (
            <article
              key={c.id}
              className="rounded-tile bg-void/60 flex w-[150px] shrink-0 snap-start flex-col border border-white/[0.08] p-2.5"
            >
              <div className="bg-graphite relative aspect-square overflow-hidden rounded-xl">
                <Image
                  src={c.image}
                  alt={`${c.name} mount`}
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
                {FLAME_SKULL_MOUNT.name}
              </div>
              <div className="mt-1.5 mb-auto flex flex-wrap items-baseline gap-x-1.5">
                <Money value={price} className="text-bone font-mono text-[13.5px] font-bold" />
                {off > 0 ? (
                  <Money value={FLAME_SKULL_MOUNT.compareAtPrice} strike className="text-[11px]" />
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => add(c.id)}
                aria-label={`Add ${c.name} to cart`}
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
