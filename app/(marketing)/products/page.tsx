import type { Metadata } from "next"
import Link from "next/link"

import { pageMetadata } from "@/components/marketing/page-metadata"
import { Section } from "@/components/marketing/section"
import { TrustStrip } from "@/components/marketing/trust-strip"
import { COLOURWAYS } from "@/features/catalog/catalog"
import { ShopView } from "@/features/catalog/components/shop-view"
import { listProducts } from "@/features/catalog/server/catalog.service"
import { toShopProduct } from "@/features/catalog/shop"

const colours = COLOURWAYS.map((c) => c.name)

export const metadata: Metadata = pageMetadata({
  title: "Shop all mounts",
  description: `Every SKELMET helmet wall mount, each in ${colours.slice(0, -1).join(", ")} and ${colours.at(-1)}. 3D-printed in India, delivered across India.`,
  path: "/products",
})

// Do NOT read searchParams: it makes the route dynamic. ShopView reads the filters on the client.
// Revalidated each minute for live price and stock; admin edits refresh it at once.
export const revalidate = 60

export default async function ProductsPage() {
  const result = await listProducts()
  // Thrown, so ISR keeps the last good page instead of caching a broken one.
  if (!result.ok) throw new Error(`[SHOP] catalog unavailable: ${result.error}`)

  return (
    <>
      <Section className="pt-6 sm:pt-8 xl:pt-8">
        <nav
          aria-label="Breadcrumb"
          className="text-dim mb-4 flex items-center gap-2.5 font-mono text-[11px] tracking-[0.12em] uppercase"
        >
          <Link href="/" className="hover:text-bone">
            Home
          </Link>
          <span aria-hidden>/</span>
          <span className="text-bone">Shop</span>
        </nav>
        <h1 className="font-display text-bone mb-6 text-[38px] leading-[1.0] uppercase sm:text-[46px]">
          All mounts
        </h1>
        <ShopView products={result.data.map(toShopProduct)} />
      </Section>

      <TrustStrip />
    </>
  )
}
