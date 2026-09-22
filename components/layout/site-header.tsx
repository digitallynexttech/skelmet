"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu, X } from "lucide-react"

import { CartButton } from "@/components/layout/cart-button"
import { Wordmark } from "@/components/shared/wordmark"
import { ButtonLink } from "@/components/ui/button"
import { primaryNav } from "@/config/nav"
import { FLAME_SKULL_MOUNT } from "@/features/catalog/catalog"
import { formatMoney } from "@/lib/money"
import { cn } from "@/lib/utils"

export function SiteHeader() {
  const pathname = usePathname()
  const [open, setOpen] = React.useState(false)
  const [openedOn, setOpenedOn] = React.useState(pathname)

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

  return (
    <>
      <header className="bg-void/80 sticky top-0 z-50 border-b border-white/[0.07] backdrop-blur-xl">
        <div className="flex h-[74px] items-center justify-between px-5 sm:px-8 xl:px-14">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Open menu"
              aria-expanded={open}
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
                  className={cn(
                    "text-[13.5px] font-medium tracking-[0.06em] uppercase transition-colors",
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
              href="/product/flame-skull-mount"
              variant="accent"
              size="xs"
              className="hidden sm:inline-flex"
            >
              Buy now
            </ButtonLink>
          </div>
        </div>
      </header>

      {/* Mobile sheet */}
      <div
        className={cn(
          "fixed inset-0 z-60 lg:hidden",
          open ? "pointer-events-auto" : "pointer-events-none",
        )}
        aria-hidden={!open}
      >
        <button
          type="button"
          tabIndex={-1}
          aria-label="Close menu"
          onClick={() => setOpen(false)}
          className={cn(
            "bg-void/80 absolute inset-0 backdrop-blur-sm transition-opacity duration-300",
            open ? "opacity-100" : "opacity-0",
          )}
        />
        <div
          className={cn(
            "bg-carbon absolute inset-y-0 left-0 flex w-[86%] max-w-[360px] flex-col border-r border-white/[0.08] transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
            open ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="flex h-[74px] items-center justify-between border-b border-white/[0.07] px-5">
            <Wordmark size="sm" />
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
              Grab yours · {formatMoney(FLAME_SKULL_MOUNT.price)}
            </ButtonLink>
          </div>
        </div>
      </div>
    </>
  )
}
