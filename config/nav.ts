import type { Permission } from "@/lib/constants"
import { PERMISSIONS } from "@/lib/constants"

export type NavItem = {
  label: string
  href: string
  /** Cosmetic only: proxy.ts and the service guard are the enforcement (§6). */
  scope?: Permission
}

export const primaryNav: NavItem[] = [
  { label: "Shop", href: "/shop" },
  { label: "The Build", href: "/product/flame-skull-mount#build" },
  { label: "Riders", href: "/riders" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
]

export const footerNav: Array<{ title: string; items: NavItem[] }> = [
  {
    title: "Shop",
    items: [
      { label: "All mounts", href: "/shop" },
      { label: "Blaze Orange", href: "/product/flame-skull-mount?colourway=blaze" },
      { label: "Militia Olive", href: "/product/flame-skull-mount?colourway=olive" },
      { label: "Ghost Grey", href: "/product/flame-skull-mount?colourway=ghost" },
      { label: "Bulk & clubs", href: "/contact?topic=bulk" },
    ],
  },
  {
    title: "Help",
    items: [
      { label: "Track order", href: "/track" },
      { label: "Install guide", href: "/product/flame-skull-mount#install" },
      { label: "Shipping policy", href: "/policies/shipping" },
      { label: "Returns & refunds", href: "/policies/returns" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    title: "Legal",
    items: [
      { label: "Privacy policy", href: "/policies/privacy" },
      { label: "Terms of service", href: "/policies/terms" },
      { label: "Refund policy", href: "/policies/returns" },
      { label: "About us", href: "/about" },
    ],
  },
]

export const accountNav: NavItem[] = [
  { label: "Overview", href: "/account" },
  { label: "Orders", href: "/account/orders" },
  { label: "Addresses", href: "/account/addresses" },
  { label: "Referrals", href: "/account/referrals" },
  { label: "Profile", href: "/account/profile" },
]

export const adminNav: NavItem[] = [
  { label: "Dashboard", href: "/admin", scope: PERMISSIONS.DASHBOARD_READ },
  { label: "Orders", href: "/admin/orders", scope: PERMISSIONS.ORDER_READ },
  { label: "Products", href: "/admin/products", scope: PERMISSIONS.PRODUCT_WRITE },
  { label: "Coupons", href: "/admin/coupons", scope: PERMISSIONS.COUPON_WRITE },
  { label: "Referrals", href: "/admin/referrals", scope: PERMISSIONS.REFERRAL_APPROVE },
  { label: "Reviews", href: "/admin/reviews", scope: PERMISSIONS.REVIEW_MODERATE },
  { label: "Inquiries", href: "/admin/inquiries", scope: PERMISSIONS.INQUIRY_READ },
  { label: "Settings", href: "/admin/settings", scope: PERMISSIONS.SETTING_WRITE },
]
