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
import { TheHook } from "@/components/marketing/the-hook"
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
      images: [{ url: product.gallery[0]!.src }],
    },
  }
}

export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<Params>
  searchParams: Promise<{ colour?: string }>
}) {
  const { slug } = await params
  const { colour } = await searchParams
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

      <ProductDetail product={product} initialColourway={colour} />

      <TrustStrip />

      {/* <ThePoint /> */}
      <WhyCare />
      <MoreThanMount />
      <Anatomy />
      <Texture />
      <InstallSteps />
      <TheHook />
      <Comparison />
      <Reviews />
      <RiderWall />
      <FaqSection />

      <StickyBuyBar price={product.price} />
    </>
  )
}
