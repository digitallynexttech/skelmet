import type { Metadata } from "next"

/**
 * Every admin page names itself in its page.tsx ("Orders - SKELMET", by the
 * root layout's template) and says what it is for. This description stands
 * for any that does not, in place of the storefront's sales line.
 */
export const metadata: Metadata = {
  description:
    "Run the SKELMET shop: orders, customers, products, offers, the newsletter, the blog and settings.",
  robots: { index: false, follow: false },
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children
}
