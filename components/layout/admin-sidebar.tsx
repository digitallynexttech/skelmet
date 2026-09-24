"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import {
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Package,
  Percent,
  ShoppingBag,
  Users,
  X,
} from "lucide-react"

import { Wordmark } from "@/components/shared/wordmark"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { PERMISSIONS, type Permission } from "@/lib/constants"
import { cn } from "@/lib/utils"

const NAV = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard, scope: PERMISSIONS.DASHBOARD_READ },
  { label: "Orders", href: "/admin/orders", icon: ShoppingBag, scope: PERMISSIONS.ORDER_READ },
  { label: "Products", href: "/admin/products", icon: Package, scope: PERMISSIONS.PRODUCT_WRITE },
  // Gated on ORDER_READ, not a scope of its own: a customer list is the
  // same personal data the orders screen already shows, just grouped by
  // person, so anyone who can read orders can already see all of it.
  { label: "Customers", href: "/admin/customers", icon: Users, scope: PERMISSIONS.ORDER_READ },
  {
    label: "Offers & codes",
    href: "/admin/coupons",
    icon: Percent,
    scope: PERMISSIONS.COUPON_READ,
  },
  {
    label: "Inquiries",
    href: "/admin/inquiries",
    icon: MessageSquare,
    scope: PERMISSIONS.INQUIRY_READ,
  },
] as const

export function AdminSidebar({ permissions }: { permissions: Permission[] }) {
  const pathname = usePathname()
  const [open, setOpen] = React.useState(false)
  const [openedOn, setOpenedOn] = React.useState(pathname)
  const [confirmingSignOut, setConfirmingSignOut] = React.useState(false)
  // signOut navigates away, so this never has to be unset — it keeps the
  // button from being pressed twice while the redirect is in flight.
  const [signingOut, setSigningOut] = React.useState(false)

  if (open && openedOn !== pathname) setOpen(false)

  // Cosmetic filter only - proxy.ts and requirePermission are the enforcement.
  const items = NAV.filter((item) => permissions.includes(item.scope))

  const body = (
    <>
      <div className="flex h-[68px] items-center gap-3 border-b border-white/[0.07] px-5">
        <Wordmark size="sm" />
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
        {items.map((item) => {
          const active =
            item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-xl px-3.5 text-[14px] transition-colors",
                active
                  ? "bg-blaze/12 text-bone font-semibold"
                  : "text-ash hover:text-bone hover:bg-white/[0.04]",
              )}
            >
              <item.icon
                className={cn("size-[18px] shrink-0", active ? "text-blaze" : "text-dim")}
                strokeWidth={1.8}
              />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-white/[0.07] p-3">
        <button
          type="button"
          onClick={() => setConfirmingSignOut(true)}
          className="text-ash hover:text-magenta flex min-h-11 w-full items-center gap-3 rounded-md px-3.5 text-[14px] transition-colors hover:bg-white/[0.04]"
        >
          <LogOut className="text-dim size-[18px] shrink-0" strokeWidth={1.8} />
          Sign out
        </button>
      </div>
    </>
  )

  return (
    <>
      {/* Mobile trigger */}
      <button
        type="button"
        aria-label="Open menu"
        onClick={() => {
          setOpenedOn(pathname)
          setOpen(true)
        }}
        className="bg-carbon text-bone fixed top-3.5 left-4 z-50 flex size-11 items-center justify-center rounded-xl border border-white/10 lg:hidden"
      >
        <Menu className="size-5" strokeWidth={2} />
      </button>

      <aside className="bg-carbon sticky top-0 hidden h-dvh w-[248px] shrink-0 flex-col border-r border-white/[0.07] lg:flex">
        {body}
      </aside>

      <div
        className={cn("fixed inset-0 z-50 lg:hidden", open ? "" : "pointer-events-none")}
        aria-hidden={!open}
      >
        <button
          type="button"
          tabIndex={-1}
          aria-label="Close menu"
          onClick={() => setOpen(false)}
          className={cn(
            "bg-void/80 absolute inset-0 transition-opacity duration-300",
            open ? "opacity-100" : "opacity-0",
          )}
        />
        <div
          className={cn(
            "bg-carbon absolute inset-y-0 left-0 flex w-[262px] flex-col border-r border-white/[0.08] transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
            open ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="text-bone absolute top-3.5 right-3 z-10 flex size-10 items-center justify-center"
          >
            <X className="size-5" strokeWidth={2} />
          </button>
          {body}
        </div>
      </div>

      {/* Mounted once, outside both copies of `body`, or the drawer and the
          desktop rail would each render their own dialog. */}
      <ConfirmDialog
        open={confirmingSignOut}
        title="Sign out?"
        body="You will need your email and password to get back into the console."
        confirmLabel="Sign out"
        tone="danger"
        pending={signingOut}
        onConfirm={() => {
          setSigningOut(true)
          void signOut({ callbackUrl: "/login" })
        }}
        onClose={() => setConfirmingSignOut(false)}
      />
    </>
  )
}
