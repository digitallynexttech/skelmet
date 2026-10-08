import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { Anatomy } from "@/components/marketing/anatomy"
import { Comparison } from "@/components/marketing/comparison"
import { FaqSection } from "@/components/marketing/faq-section"
import { InstallSteps } from "@/components/marketing/install-steps"
import { pageMetadata } from "@/components/marketing/page-metadata"
import { Reviews } from "@/components/marketing/reviews"
import { RiderWall } from "@/components/marketing/rider-wall"
import { Texture } from "@/components/marketing/texture"
import { MoreThanMount } from "@/components/marketing/more-than-mount"
import { TrustStrip } from "@/components/marketing/trust-strip"
import { WhyCare } from "@/components/marketing/why-care"
import { StickyBuyBar } from "@/components/layout/sticky-buy-bar"
import { ProductDetail } from "@/features/catalog/components/product-detail"
import { FLAME_SKULL_MOUNT, PRODUCTS, getProduct } from "@/features/catalog/catalog"
import { getProductBySlug } from "@/features/catalog/server/catalog.service"
import { shippingCharge } from "@/features/settings/server/runtime-settings"
import { PixelViewContent } from "@/features/visitors/components/meta-pixel"

type Params = { slug: string }

export function generateStaticParams(): Params[] {
  return PRODUCTS.map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params
  const product = getProduct(slug)
  if (!product) return { title: "Not found" }

  // Plain description for search and shares, not the strapline.
  const colours = product.colourways.map((c) => c.name)
  const last = colours.pop()
  const colourList = colours.length > 0 ? `${colours.join(", ")} and ${last}` : last
  const kind = product.slug === FLAME_SKULL_MOUNT.slug ? "flame-skull" : "piston-skull"
  const description = `A 3D-printed ${kind} wall mount for motorcycle helmets, with hooks for gloves, jacket and keys. In ${colourList}. Made in India, delivered across India.`

  return pageMetadata({
    title: product.name,
    description,
    path: `/product/${product.slug}`,
    // Metadata is per slug, not per colourway: share the first one's front shot.
    image: { url: product.colourways[0]!.image, alt: `${product.name}, front view` },
  })
}

// Do NOT read searchParams: it makes the route dynamic (uncacheable, no SSR markup,
// notFound() answers 200). The colour picker reads ?colour= on the client instead.
// Revalidated each minute for live price and stock; admin edits refresh it at once.
// Unknown slugs get a real 404 from proxy.ts. Not `dynamicParams = false`: after
// revalidatePath that 404s the product itself.
export const revalidate = 60

export default async function ProductPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params
  const [result, charge] = await Promise.all([getProductBySlug(slug), shippingCharge()])
  const product = result.ok ? result.data : null
  if (!product) notFound()

  // Same sections for every product, filled from product.sections (catalog.ts).
  const { sections } = product

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

      <ProductDetail product={product} freeShipping={charge.sharePercent === 0} />
      <PixelViewContent
        sku={product.colourways[0]!.sku}
        name={product.name}
        price={product.price}
      />

      <TrustStrip />

      <WhyCare />
      <MoreThanMount shots={sections.inUse} />
      <Anatomy product={product} />
      {/* CTA goes to the buy panel, not to this same page. */}
      <Texture ctaHref="#buy" price={product.price} finish={sections.finish} />
      <InstallSteps picture={sections.install} />
      <Comparison looksLike={sections.looksLike} />
      <Reviews product={product} />
      <RiderWall />
      <FaqSection picture={sections.faq} answers={sections.faqAnswers} />

      <StickyBuyBar
        productSlug={product.slug}
        price={product.price}
        defaultColourway={product.colourways[0]!.id}
      />
    </>
  )
}
