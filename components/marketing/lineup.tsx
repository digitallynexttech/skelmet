import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { LineupCard } from "@/components/marketing/lineup-card"
import { Section, SectionHeading } from "@/components/marketing/section"
import { SectionLabel } from "@/components/shared/section-label"
import { buttonVariants } from "@/components/ui/button"
import { FLAME_SKULL_MOUNT, PRODUCTS } from "@/features/catalog/catalog"
import { listProducts } from "@/features/catalog/server/catalog.service"
import { toShopProduct } from "@/features/catalog/shop"
import { cn } from "@/lib/utils"

// The hero skull's last stop. The Flame Skull's orange picture is built on this photo's
// backdrop and framing (build-colourway-cards.mjs), so the photo's plate fits it exactly.
const DOCK = "/product/product-front.jpg"

/** Home's lineup: one card per product at a third of the row, so each fits one screen. */
export async function Lineup() {
  // Registry figures if the live read fails: priced cards beat a broken home page.
  const products = await listProducts().then(
    (live) => (live.ok ? live.data : PRODUCTS),
    () => PRODUCTS,
  )

  return (
    <Section id="colourways">
      <div className="mb-10 flex flex-col gap-5 sm:mb-12 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <SectionLabel numbered className="mb-3.5">
            The lineup
          </SectionLabel>
          <SectionHeading>Pick your poison</SectionHeading>
        </div>
        <p className="text-ash max-w-[340px] text-[15px] leading-[1.6] lg:pb-2 lg:text-right">
          Two skulls, three colours each. Pick the one that speaks to you.
        </p>
      </div>

      {/* Desktop: no wider than lets a square photo and the details fit under the header,
          so a whole card is in view on a short screen too. */}
      <div className="grid gap-5 sm:grid-cols-2 lg:max-w-[max(900px,calc((100svh_-_340px)*3_+_40px))] lg:grid-cols-3">
        {products.map((product) => (
          <LineupCard
            key={product.slug}
            product={toShopProduct(product)}
            dock={product.slug === FLAME_SKULL_MOUNT.slug ? DOCK : undefined}
          />
        ))}

        {/* The row's third slot; on tablets, a strip under the two cards. */}
        <Link
          href="/products"
          className="rounded-card bg-carbon group hover:border-blaze/50 focus-visible:ring-blaze/70 relative flex min-h-[260px] flex-col justify-between gap-8 overflow-hidden border border-white/[0.1] p-7 transition-colors focus-visible:ring-2 focus-visible:outline-none sm:col-span-2 lg:col-span-1"
          style={{
            backgroundImage:
              "radial-gradient(circle at 85% 15%, rgb(255 90 31 / 0.16), transparent 55%)",
          }}
        >
          <span className="text-blaze font-mono text-[11.5px] tracking-[0.22em] uppercase">
            The shop
          </span>
          <div>
            <div className="font-display text-bone text-[44px] leading-[0.98] uppercase sm:text-[52px]">
              Shop all
              <br />
              mounts
            </div>
            <p className="text-ash mt-4 max-w-[300px] text-[14.5px] leading-[1.58]">
              Every skull we print in one place. Search, pick a colour, sort by price.
            </p>
          </div>
          <span
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "group-hover:border-blaze self-start",
            )}
          >
            Browse the shop
            <ArrowRight className="size-4" strokeWidth={2.4} />
          </span>
        </Link>
      </div>
    </Section>
  )
}
