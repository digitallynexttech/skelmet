import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { Anatomy } from "@/components/marketing/anatomy"
import { Comparison } from "@/components/marketing/comparison"
import { FaqSection } from "@/components/marketing/faq-section"
import { InstallSteps } from "@/components/marketing/install-steps"
import { Reviews } from "@/components/marketing/reviews"
import { RiderWall } from "@/components/marketing/rider-wall"
import { Texture } from "@/components/marketing/texture"
// import { TheHook } from "@/components/marketing/the-hook"   // hidden from this page
// import { ThePoint } from "@/components/marketing/the-point"
import { MoreThanMount } from "@/components/marketing/more-than-mount"
import { TrustStrip } from "@/components/marketing/trust-strip"
import { WhyCare } from "@/components/marketing/why-care"
import { StickyBuyBar } from "@/components/layout/sticky-buy-bar"
import { ProductDetail } from "@/features/catalog/components/product-detail"
import { PRODUCTS, getProduct } from "@/features/catalog/catalog"
import { getProductBySlug } from "@/features/catalog/server/catalog.service"

type Params = { slug: string }

export function generateStaticParams(): Params[] {
  return PRODUCTS.map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params
  const product = getProduct(slug)
  if (!product) return { title: "Not found" }

  return {
    title: product.name,
    description: product.strapline,
    alternates: { canonical: `/product/${product.slug}` },
    openGraph: {
      title: product.name,
      description: product.strapline,
      // Blaze is the canonical finish for sharing: metadata is per slug,
        // not per selected colourway.
        images: [{ url: product.gallery[0]!.src.blaze }],
    },
  }
}

/**
 * Deliberately does NOT read searchParams.
 *
 * Reading it opted the whole route into dynamic rendering, and that one line
 * cost three separate things: the page answered
 * `private, no-cache, no-store` so no CDN could ever hold it - on the busiest
 * page of a shop; it shipped no markup, so crawlers saw an empty shell with no
 * <h1>; and notFound() in a dynamic route returns HTTP 200, so every dead
 * product URL told Google it was fine.
 *
 * ?colour= is read on the client instead, by the picker that already owns that
 * state. The cost is that a shared ?colour=ghost link paints the default
 * swatch for one frame before switching - which is cheap next to the page
 * being uncacheable.
 */
/**
 * Only the slugs generateStaticParams knows are real routes; anything else is
 * a genuine 404 rather than a 200 carrying a not-found page. notFound() in a
 * route that still renders unknown params on demand answers HTTP 200, so every
 * mistyped or dead product URL was telling crawlers the page was fine.
 *
 * The catalogue lives in code, so a new product already needs a deploy - this
 * takes nothing away today. It would need revisiting alongside ISR the day
 * products come from the database and can appear between builds.
 */
export const dynamicParams = false

export default async function ProductPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params
  const result = await getProductBySlug(slug)
  const product = result.ok ? result.data : null
  if (!product) notFound()

  return (
    <>
      <nav
        aria-label="Breadcrumb"
        className="text-dim flex items-center gap-2.5 px-5 pt-6 font-mono text-[11px] tracking-[0.12em] uppercase sm:px-8 xl:px-14"
      >
        <Link href="/" className="hover:text-bone">
          Home
        </Link>
        <span aria-hidden>/</span>
        <span className="text-bone">{product.name}</span>
      </nav>

      <ProductDetail product={product} />

      <TrustStrip />

      {/* <ThePoint /> */}
      <WhyCare />
      <MoreThanMount />
      <Anatomy />
      {/* Links back up to the buy panel: on this page the product link
          would only point at the page the reader is already on. */}
      <Texture ctaHref="#buy" />
      <InstallSteps />
      {/* <TheHook /> */}
      <Comparison />
      <Reviews />
      <RiderWall />
      <FaqSection />

      <StickyBuyBar price={product.price} />
    </>
  )
}
