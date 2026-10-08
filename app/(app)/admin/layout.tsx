import type { Metadata } from "next"

// Fallback description for admin pages, in place of the storefront's sales line.
export const metadata: Metadata = {
  description:
    "Run the SKELMET shop: orders, customers, products, offers, the newsletter, the blog and settings.",
  robots: { index: false, follow: false },
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children
}
