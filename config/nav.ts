import { siteConfig } from "@/config/site"
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
  // In the menu once there is a Sanity project for it to read (config/site.ts).
  ...(siteConfig.sanity.projectId ? [{ label: "Blog", href: "/blog" }] : []),
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
]

export const footerNav: Array<{ title: string; items: NavItem[] }> = [
  {
    title: "Shop",
    items: [
      { label: "All mounts", href: "/product/flame-skull-mount" },
      // ?colour= is what the product page's picker reads (product-detail.tsx).
      { label: "Blaze Orange", href: "/product/flame-skull-mount?colour=blaze" },
      { label: "Militia Olive", href: "/product/flame-skull-mount?colour=olive" },
      { label: "Ghost Grey", href: "/product/flame-skull-mount?colour=ghost" },
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
      { label: "Returns, refunds & cancellation", href: "/policies/returns" },
    ],
  },
]
