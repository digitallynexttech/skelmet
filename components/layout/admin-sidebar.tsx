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
  Settings,
  ShoppingBag,
  Star,
  Users,
  X,
} from "lucide-react"

import { SkullMark } from "@/components/shared/skull-mark"
import { PERMISSIONS, type Permission } from "@/lib/constants"
import { cn } from "@/lib/utils"

const NAV = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard, scope: PERMISSIONS.DASHBOARD_READ },
  { label: "Orders", href: "/admin/orders", icon: ShoppingBag, scope: PERMISSIONS.ORDER_READ },
  { label: "Products", href: "/admin/products", icon: Package, scope: PERMISSIONS.PRODUCT_WRITE },
  { label: "Offers & codes", href: "/admin/coupons", icon: Percent, scope: PERMISSIONS.COUPON_READ },
  { label: "Referrals", href: "/admin/referrals", icon: Users, scope: PERMISSIONS.REFERRAL_READ },
  { label: "Reviews", href: "/admin/reviews", icon: Star, scope: PERMISSIONS.REVIEW_READ },
  { label: "Inquiries", href: "/admin/inquiries", icon: MessageSquare, scope: PERMISSIONS.INQUIRY_READ },
  { label: "Settings", href: "/admin/settings", icon: Settings, scope: PERMISSIONS.SETTING_READ },
] as const

export function AdminSidebar({
  permissions,
  user,
}: {
  permissions: Permission[]
  user: { name: string | null; email: string }
}) {
  const pathname = usePathname()
  const [open, setOpen] = React.useState(false)
  const [openedOn, setOpenedOn] = React.useState(pathname)

  if (open && openedOn !== pathname) setOpen(false)

  // Cosmetic filter only — proxy.ts and requirePermission are the enforcement.
  const items = NAV.filter((item) => permissions.includes(item.scope))

  const body = (
    <>
      <div className="flex h-[68px] items-center gap-3 border-b border-white/[0.07] px-5">
        <SkullMark className="size-6" />
        <div className="min-w-0">
          <div className="font-display text-[19px] leading-none tracking-[0.14em] text-bone">
            SKELMET
          </div>
          <div className="mt-1 font-mono text-[9.5px] tracking-[0.16em] text-dim">CONSOLE</div>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
        {items.map((item) => {
          const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-xl px-3.5 text-[14px] transition-colors",
                active
                  ? "bg-blaze/12 font-semibold text-bone"
                  : "text-ash hover:bg-white/[0.04] hover:text-bone",
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
        <div className="mb-2 px-3.5 py-2">
          <div className="truncate text-[13.5px] font-semibold text-bone">
            {user.name ?? "Staff"}
          </div>
          <div className="truncate font-mono text-[10.5px] text-dim">{user.email}</div>
        </div>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3.5 text-[14px] text-ash transition-colors hover:bg-white/[0.04] hover:text-magenta"
        >
          <LogOut className="size-[18px] shrink-0 text-dim" strokeWidth={1.8} />
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
        className="fixed top-3.5 left-4 z-50 flex size-11 items-center justify-center rounded-xl border border-white/10 bg-carbon text-bone lg:hidden"
      >
        <Menu className="size-5" strokeWidth={2} />
      </button>

      <aside className="hidden w-[248px] shrink-0 flex-col border-r border-white/[0.07] bg-carbon lg:flex">
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
            "absolute inset-0 bg-void/80 transition-opacity duration-300",
            open ? "opacity-100" : "opacity-0",
          )}
        />
        <div
          className={cn(
            "absolute inset-y-0 left-0 flex w-[262px] flex-col border-r border-white/[0.08] bg-carbon transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
            open ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute top-3.5 right-3 z-10 flex size-10 items-center justify-center text-bone"
          >
            <X className="size-5" strokeWidth={2} />
          </button>
          {body}
        </div>
      </div>
    </>
  )
}
