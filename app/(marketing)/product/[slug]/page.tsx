import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { Anatomy } from "@/components/marketing/anatomy"
import { Comparison } from "@/components/marketing/comparison"
import { FaqSection } from "@/components/marketing/faq-section"
import { Gifting } from "@/components/marketing/gifting"
import { InstallSteps } from "@/components/marketing/install-steps"
import { Reviews } from "@/components/marketing/reviews"
import { RiderWall } from "@/components/marketing/rider-wall"
import { Section, SectionHeading } from "@/components/marketing/section"
import { Texture } from "@/components/marketing/texture"
import { TheHook } from "@/components/marketing/the-hook"
import { ThePoint } from "@/components/marketing/the-point"
import { TrustStrip } from "@/components/marketing/trust-strip"
import { StickyBuyBar } from "@/components/layout/sticky-buy-bar"
import { SectionLabel } from "@/components/shared/section-label"
import { ProductDetail } from "@/features/catalog/components/product-detail"
import { PRODUCTS, getProduct } from "@/features/catalog/catalog"
import { cn } from "@/lib/utils"

type Params = { slug: string }

export function generateStaticParams(): Params[] {
  return PRODUCTS.map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>
}): Promise<Metadata> {
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

export default async function ProductPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params
  const product = getProduct(slug)
  if (!product) notFound()

  return (
    <>
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-2.5 px-5 pt-6 font-mono text-[11px] tracking-[0.12em] text-dim uppercase sm:px-8 xl:px-14"
      >
        <Link href="/" className="hover:text-bone">
          Home
        </Link>
        <span aria-hidden>/</span>
        <Link href="/shop" className="hover:text-bone">
          Shop
        </Link>
        <span aria-hidden>/</span>
        <span className="text-bone">{product.name}</span>
      </nav>

      <ProductDetail product={product} />

      <TrustStrip />

      {/* Spec numbers */}
      <Section className="border-b border-white/[0.07] bg-carbon">
        <SectionLabel className="mb-3.5">The numbers</SectionLabel>
        <SectionHeading className="mb-9 text-[34px] sm:text-[44px] xl:text-[46px]">
          Specifications
        </SectionHeading>
        <dl className="grid grid-cols-2 gap-3.5 lg:grid-cols-3 xl:grid-cols-6">
          {product.specs.map((spec) => (
            <div
              key={spec.label}
              className="rounded-tile border border-white/[0.08] bg-void p-5 sm:p-6"
            >
              <dt className="mb-3 font-mono text-[9.5px] tracking-[0.16em] text-dim uppercase">
                {spec.label}
              </dt>
              <dd
                className={cn(
                  "font-display leading-[1.08] text-[22px] sm:text-[26px]",
                  spec.pending ? "text-ember" : "text-bone",
                )}
              >
                {spec.value}
              </dd>
            </div>
          ))}
        </dl>
      </Section>

      <ThePoint />
      <Anatomy />
      <Texture />
      <InstallSteps />
      <TheHook />
      <Comparison />
      <Reviews />
      <RiderWall />
      <Gifting />
      <FaqSection />

      <StickyBuyBar price={product.price} />
    </>
  )
}
