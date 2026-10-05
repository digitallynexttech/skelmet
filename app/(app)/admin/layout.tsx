import type { Metadata } from "next"

/**
 * Every console page names itself (its page.tsx), shown as "Orders · SKELMET
 * Console" so a tab is never mistaken for the shop's. The description is the
 * console's own, not the storefront's sales line the root layout carries.
 */
export const metadata: Metadata = {
  title: { default: "SKELMET Console", template: "%s · SKELMET Console" },
  description:
    "The SKELMET staff console: orders, customers, products, offers, the newsletter, the blog and the shop's settings.",
  robots: { index: false, follow: false },
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children
}
