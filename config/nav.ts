import type { Permission } from "@/lib/constants"

export type NavItem = {
  label: string
  href: string
  /** Cosmetic only: proxy.ts and the service guard are the enforcement (§6). */
  scope?: Permission
}

export const primaryNav: NavItem[] = [
  { label: "Shop", href: "/product/flame-skull-mount" },
  { label: "Riders", href: "/riders" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
]

export const footerNav: Array<{ title: string; items: NavItem[] }> = [
  {
    title: "Shop",
    items: [
      { label: "All mounts", href: "/product/flame-skull-mount" },
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
