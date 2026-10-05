import {
  LayoutDashboard,
  Mail,
  MessageSquare,
  Newspaper,
  Package,
  Percent,
  Settings,
  ShoppingBag,
  Users,
  type LucideIcon,
} from "lucide-react"

import { PERMISSIONS, type Permission } from "@/lib/constants"

/**
 * The console's sections, in sidebar order. Not a client module, so the
 * server can read it too: /admin sends each person to the first section here
 * they may open (firstSectionFor).
 */

export type NavChild = { label: string; href: string }

export type NavItem = {
  label: string
  href: string
  icon: LucideIcon
  scope: Permission
  /** Further pages of the section, listed under it. The item itself is the section's own page. */
  children?: NavChild[]
}

export const DASHBOARD_HREF = "/admin/dashboard"

export const NAV: NavItem[] = [
  {
    label: "Dashboard",
    href: DASHBOARD_HREF,
    icon: LayoutDashboard,
    scope: PERMISSIONS.DASHBOARD_READ,
  },
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
 * Where /admin sends someone: the dashboard for anyone who may read it, and
 * otherwise the first section they may open, rather than a page that would
 * only tell them they cannot see it.
 */
export function firstSectionFor(permissions: readonly Permission[]): string {
  return NAV.find((item) => permissions.includes(item.scope))?.href ?? DASHBOARD_HREF
}
