"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu, X } from "lucide-react"

import { CartButton } from "@/components/layout/cart-button"
import { Wordmark } from "@/components/shared/wordmark"
import { ButtonLink } from "@/components/ui/button"
import { primaryNav } from "@/config/nav"
import { buyNowHref, useBuySelection } from "@/features/catalog/hooks/use-buy-selection"
import { cn } from "@/lib/utils"

export function SiteHeader() {
  const pathname = usePathname()
  const [open, setOpen] = React.useState(false)
  const [openedOn, setOpenedOn] = React.useState(pathname)
  const menuButton = React.useRef<HTMLButtonElement>(null)
  const sheet = React.useRef<HTMLDivElement>(null)
  // On the product page, Buy now buys what is picked there - as the phone's
  // sticky bar does - instead of linking to the page it is already on.
  const onProduct = pathname.startsWith("/product/")
  const picked = useBuySelection((s) => s.colourway)
  const pickedQty = useBuySelection((s) => s.qty)

  // Close the sheet on navigation. Derived during render rather than in an
  // effect, React 19 flags setState-in-effect as a cascading render.
  if (open && openedOn !== pathname) {
    setOpen(false)
  }

  React.useEffect(() => {
    document.body.style.overflow = open ? "hidden" : ""
    return () => {
      document.body.style.overflow = ""
    }
  }, [open])

  // A modal sheet behaves like one: focus moves in when it opens, stays in
  // while it is open, Escape closes it, and focus goes back to the button.
  React.useEffect(() => {
    if (!open) return
    const panel = sheet.current
    const trigger = menuButton.current
    const focusable = () =>
      Array.from(panel?.querySelectorAll<HTMLElement>("a[href], button:not([disabled])") ?? [])
    focusable()[0]?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false)
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
      trigger?.focus()
    }
  }, [open])

  return (
    <>
      {/* Near-opaque with no blur on phones: a backdrop blur recomputed on
          every scroll frame costs a phone more than it shows. Blurred from lg. */}
      <header className="bg-void/95 lg:bg-void/80 sticky top-0 z-50 border-b border-white/[0.07] lg:backdrop-blur-xl">
        <div className="flex h-[74px] items-center justify-between px-5 sm:px-8 xl:px-14">
          <div className="flex items-center gap-3">
            <button
              ref={menuButton}
              type="button"
              aria-label="Open menu"
              aria-expanded={open}
              aria-controls="site-menu"
              onClick={() => {
                setOpenedOn(pathname)
                setOpen(true)
              }}
              className="text-bone -ml-2 flex size-11 items-center justify-center lg:hidden"
            >
              <Menu className="size-[22px]" strokeWidth={2} />
            </button>
            <Wordmark />
          </div>

          <nav className="hidden items-center gap-8 lg:flex">
            {primaryNav.map((item) => {
              const active = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    // A 44px-tall target, not the 20px of the text itself.
                    "inline-flex min-h-11 items-center text-[13.5px] font-medium tracking-[0.06em] uppercase transition-colors",
                    active ? "text-bone" : "text-ash hover:text-bone",
                  )}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>

          <div className="flex items-center gap-3">
            <CartButton />
            <ButtonLink
              href={
                onProduct && picked ? buyNowHref(picked, pickedQty) : "/product/flame-skull-mount"
              }
              variant="accent"
              size="xs"
              className="hidden sm:inline-flex"
            >
              Buy now
            </ButtonLink>
          </div>
        </div>
      </header>

      {/* Mobile sheet. Inert while closed, so its links are neither tabbable
          nor read out off-screen; a modal dialog while open. */}
      <div
        className={cn(
          "fixed inset-0 z-60 lg:hidden",
          open ? "pointer-events-auto" : "pointer-events-none",
        )}
        inert={!open}
      >
        <button
          type="button"
          tabIndex={-1}
          aria-label="Close menu"
          onClick={() => setOpen(false)}
          className={cn(
            "bg-void/85 absolute inset-0 transition-opacity duration-300",
            open ? "opacity-100" : "opacity-0",
          )}
        />
        <div
          ref={sheet}
          id="site-menu"
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          className={cn(
            "bg-carbon absolute inset-y-0 left-0 flex w-[86%] max-w-[360px] flex-col border-r border-white/[0.08] transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
            open ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="flex h-[74px] items-center justify-between border-b border-white/[0.07] px-5">
            <Wordmark size="sm" lazy />
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
              className="text-bone -mr-2 flex size-11 items-center justify-center"
            >
              <X className="size-[22px]" strokeWidth={2} />
            </button>
          </div>

          <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-5">
            {primaryNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="font-display text-bone flex min-h-[52px] items-center border-b border-white/[0.05] text-[26px] leading-[1.08] tracking-[0.02em] uppercase"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="border-t border-white/[0.07] p-5">
            <ButtonLink href="/product/flame-skull-mount" variant="primary" size="md" full>
              Grab yours
            </ButtonLink>
          </div>
        </div>
      </div>
    </>
  )
}
