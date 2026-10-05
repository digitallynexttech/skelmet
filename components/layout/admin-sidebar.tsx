"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import {
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Mail,
  MessageSquare,
  Newspaper,
  Package,
  Percent,
  Settings,
  ShoppingBag,
  Users,
  X,
  type LucideIcon,
} from "lucide-react"

import { useAdminShell } from "@/components/layout/admin-shell"
import { Wordmark } from "@/components/shared/wordmark"
import { siteConfig } from "@/config/site"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { PERMISSIONS, type Permission } from "@/lib/constants"
import { cn } from "@/lib/utils"

type NavChild = { label: string; href: string }

type NavItem = {
  label: string
  href: string
  icon: LucideIcon
  scope: Permission
  /** Further pages of the section, listed under it. The item itself is the section's own page. */
  children?: NavChild[]
}

const NAV: NavItem[] = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard, scope: PERMISSIONS.DASHBOARD_READ },
  {
    label: "Orders",
    href: "/admin/orders",
    icon: ShoppingBag,
    scope: PERMISSIONS.ORDER_READ,
    children: [
      { label: "All orders", href: "/admin/orders/all" },
      { label: "Abandoned carts", href: "/admin/orders/abandoned" },
    ],
  },
  { label: "Products", href: "/admin/products", icon: Package, scope: PERMISSIONS.PRODUCT_WRITE },
  // Gated on ORDER_READ, not a scope of its own: a customer list is the
  // same personal data the orders screen already shows, just grouped by
  // person, so anyone who can read orders can already see all of it.
  // Visitors ride along: the same shop's shoppers, most of whom never got
  // as far as an order.
  {
    label: "Customers",
    href: "/admin/customers",
    icon: Users,
    scope: PERMISSIONS.ORDER_READ,
    children: [{ label: "Visitors", href: "/admin/customers/visitors" }],
  },
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
  {
    label: "Newsletter",
    href: "/admin/newsletter",
    icon: Mail,
    scope: PERMISSIONS.NEWSLETTER_READ,
    children: [{ label: "Write an email", href: "/admin/newsletter/emails" }],
  },
  { label: "Blog", href: "/admin/blog", icon: Newspaper, scope: PERMISSIONS.POST_READ },
  {
    label: "Settings",
    href: "/admin/settings",
    icon: Settings,
    scope: PERMISSIONS.SETTING_READ,
  },
]

/**
 * The "↳" from a section down into one of its pages, as in the KYG console.
 *
 * The numbers come from the section's row, not the eye: px-3.5 and an 18px
 * icon put the icon's centre 23px in, and the stroke sits at x=1 here, so the
 * svg goes at left-[22px]. The pages' list is py-0.5, so -top-0.5 starts the
 * line on the section row's bottom edge; a page row is h-9, so its centre is
 * 2 + 18 = 20px down, where the line turns and the arrowhead points. The page
 * pill starts at 36px, clear of the arrow's tip at 33. Change the row's
 * padding or icon and these move with it.
 */
function Elbow() {
  return (
    <svg
      width={16}
      height={23}
      viewBox="0 0 16 23"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="miter"
      aria-hidden
      className="pointer-events-none absolute -top-0.5 left-[22px] text-white/25"
    >
      <path d="M1 0v20h10" />
      <path d="m9 18 2 2-2 2" />
    </svg>
  )
}

const within = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`)

/**
 * The child a page belongs to: the longest href it sits under. None for the
 * section's own pages - an order's page belongs to Orders itself.
 */
function currentChild(pathname: string, children: NavChild[]): NavChild | undefined {
  return children
    .filter((c) => within(pathname, c.href))
    .sort((a, b) => b.href.length - a.href.length)[0]
}

export function AdminSidebar({ permissions }: { permissions: Permission[] }) {
  const pathname = usePathname()
  // Open and closed live in the shell, so the header's toggle and Ctrl+B
  // reach them too.
  const { collapsed, drawerOpen: open, closeDrawer } = useAdminShell()
  const [confirmingSignOut, setConfirmingSignOut] = React.useState(false)
  // signOut navigates away, so this never has to be unset — it keeps the
  // button from being pressed twice while the redirect is in flight.
  const [signingOut, setSigningOut] = React.useState(false)

  // Cosmetic filter only - proxy.ts and requirePermission are the enforcement.
  const items = NAV.filter((item) => permissions.includes(item.scope))

  // compact: the desktop rail closed to its icons - the skull mark for the
  // lockup, each section an icon named by its tooltip and for screen readers,
  // and no pages under a section. The phone drawer is never compact.
  const body = (compact: boolean) => (
    <>
      <div
        className={cn(
          "flex h-[68px] items-center border-b border-white/[0.07]",
          compact ? "justify-center" : "gap-3 px-5",
        )}
      >
        {compact ? (
          <Link href="/" title={siteConfig.name} className="inline-flex items-center">
            <Image
              src="/brand/skelmet-mark.png"
              width={351}
              height={435}
              alt={siteConfig.name}
              sizes="32px"
              className="h-8 w-auto"
            />
          </Link>
        ) : (
          <Wordmark size="sm" />
        )}
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
        {items.map((item) => {
          const active =
            item.href === "/admin" ? pathname === "/admin" : within(pathname, item.href)
          const current =
            item.children && active ? currentChild(pathname, item.children) : undefined
          // The section's own page, rather than one of the pages under it.
          const here = active && !current
          // On the closed rail the pages under a section are not shown, so
          // the section lights up for any of them.
          const lit = compact ? active : here
          return (
            <div key={item.href}>
              <Link
                href={item.href}
                aria-current={here ? "page" : lit ? "true" : undefined}
                title={compact ? item.label : undefined}
                // Only the page you are on lights up: on one of the section's
                // pages the section itself stays plain, or two rows would both
                // read as the current page. The arrow says which section.
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-xl text-[14px] transition-colors",
                  compact ? "justify-center" : "px-3.5",
                  lit
                    ? "bg-blaze/12 text-bone font-semibold"
                    : "text-ash hover:text-bone hover:bg-white/[0.04]",
                )}
              >
                <item.icon
                  className={cn("size-[18px] shrink-0", lit ? "text-blaze" : "text-dim")}
                  strokeWidth={1.8}
                />
                <span className={compact ? "sr-only" : undefined}>{item.label}</span>
                {/* Says the section has pages under it; turns down while
                    they are showing. */}
                {item.children && !compact ? (
                  <ChevronRight
                    aria-hidden
                    className={cn(
                      "text-dim ml-auto size-4 shrink-0 transition-transform duration-200",
                      active && "rotate-90",
                    )}
                    strokeWidth={2}
                  />
                ) : null}
              </Link>
              {/* A section's pages show only while you are in it, so the
                  menu stays short: on Visitors, Orders is one row. Opening
                  the section is one click on its name. */}
              {item.children && active && !compact ? (
                <ul className="flex flex-col gap-0.5 py-0.5">
                  {item.children.map((child) => {
                    const on = current?.href === child.href
                    return (
                      <li key={child.href} className="relative">
                        <Elbow />
                        {/* ml-[36px] insets the pill past the arrow; with px-2
                            the label lands on 44px, level with the section's. */}
                        <Link
                          href={child.href}
                          aria-current={on ? "page" : undefined}
                          className={cn(
                            "ml-[36px] flex min-h-9 items-center rounded-lg px-2 text-[13.5px] transition-colors",
                            on
                              ? "bg-blaze/12 text-bone font-semibold"
                              : "text-ash hover:text-bone hover:bg-white/[0.04]",
                          )}
                        >
                          {child.label}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              ) : null}
            </div>
          )
        })}
      </nav>

      <div className="border-t border-white/[0.07] p-3">
        <button
          type="button"
          onClick={() => setConfirmingSignOut(true)}
          title={compact ? "Sign out" : undefined}
          className={cn(
            "text-ash hover:text-magenta flex min-h-11 w-full items-center gap-3 rounded-md text-[14px] transition-colors hover:bg-white/[0.04]",
            compact ? "justify-center" : "px-3.5",
          )}
        >
          <LogOut className="text-dim size-[18px] shrink-0" strokeWidth={1.8} />
          <span className={compact ? "sr-only" : undefined}>Sign out</span>
        </button>
      </div>
    </>
  )

  return (
    <>
      {/* Closed, the rail narrows to its icons rather than going away. */}
      <aside
        id="admin-sidebar"
        className={cn(
          "bg-carbon sticky top-0 hidden h-dvh shrink-0 flex-col overflow-hidden border-r border-white/[0.07] transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] lg:flex",
          collapsed ? "w-[72px]" : "w-[248px]",
        )}
      >
        {body(collapsed)}
      </aside>

      <div
        className={cn("fixed inset-0 z-50 lg:hidden", open ? "" : "pointer-events-none")}
        aria-hidden={!open}
      >
        <button
          type="button"
          tabIndex={-1}
          aria-label="Close menu"
          onClick={closeDrawer}
          className={cn(
            "bg-void/80 absolute inset-0 transition-opacity duration-300",
            open ? "opacity-100" : "opacity-0",
          )}
        />
        <div
          id="admin-drawer"
          className={cn(
            "bg-carbon absolute inset-y-0 left-0 flex w-[262px] flex-col border-r border-white/[0.08] transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
            open ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <button
            type="button"
            aria-label="Close menu"
            onClick={closeDrawer}
            className="text-bone absolute top-3.5 right-3 z-10 flex size-10 items-center justify-center"
          >
            <X className="size-5" strokeWidth={2} />
          </button>
          {body(false)}
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
