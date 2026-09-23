import type { Metadata } from "next"

import { Anatomy } from "@/components/marketing/anatomy"
// import { AnyWall } from "@/components/marketing/any-wall"   // hidden from this page
import { Bento } from "@/components/marketing/bento"
import { ColourwayGrid } from "@/components/marketing/colourway-grid"
import { Comparison } from "@/components/marketing/comparison"
import { TICKER_ITEMS } from "@/components/marketing/content"
import { DropList } from "@/components/marketing/drop-list"
import { FaqSection } from "@/components/marketing/faq-section"
import { Hero } from "@/components/marketing/hero"
// import { InstallSteps } from "@/components/marketing/install-steps"   // hidden from this page
// import { ReelStrip } from "@/components/marketing/reel-strip"   // hidden from this page
import { Reviews } from "@/components/marketing/reviews"
import { RiderWall } from "@/components/marketing/rider-wall"
import { Texture } from "@/components/marketing/texture"
// import { TheHook } from "@/components/marketing/the-hook"   // hidden from this page
// import { ThePoint } from "@/components/marketing/the-point"
import { TrustStrip } from "@/components/marketing/trust-strip"
import { MarqueeTicker } from "@/components/shared/marquee-ticker"
import { siteConfig } from "@/config/site"

export const metadata: Metadata = {
  title: `${siteConfig.name} · ${siteConfig.tagline}`,
  description: siteConfig.description,
  alternates: { canonical: "/" },
}

/**
 * Server component by design. The standard's `"use client"` page default is for
 * the authenticated product, where every page is hook-driven; this one is
 * static marketing, so it stays on the server and only the genuinely
 * interactive leaves (add-to-cart, accordion, header) ship JavaScript.
 */
/**
 * Regenerated at most once a minute, because the lineup cards now quote live
 * prices. Left purely static they were baked at build: after a price change
 * the homepage advertised one figure while the product page and checkout used
 * another, which is the mismatch this page exists to avoid. Fully dynamic
 * would be the wrong trade for a marketing page carrying a 3D hero — a minute
 * of staleness on a price an admin just edited is the cheaper side.
 */
export const revalidate = 60

export default function HomePage() {
  return (
    <>
      <Hero />
      <MarqueeTicker items={TICKER_ITEMS} />
      <TrustStrip />
      {/* The eyebrow number is passed here rather than baked into each
          section, because it describes a position in THIS page's run — the
          same block is 05 here and 03 on the product page. Commenting a
          section out therefore only means deleting a line and closing the
          numbers up, with no component edited and no other page disturbed. */}
      <ColourwayGrid index="01" />
      <Bento index="02" />
      <Anatomy index="03" />
      <Texture index="04" />
      <Comparison index="05" />
      <RiderWall index="06" />
      <Reviews index="07" />
      <FaqSection index="08" />
      <DropList index="09" />

      {/* Hidden, not deleted — all five still render on other routes and are
          one uncomment away from returning. Put a section back in its place in
          the run above and renumber from there. */}
      {/* <ThePoint /> */}
      {/* <InstallSteps /> */}
      {/* <TheHook /> */}
      {/* <ReelStrip /> */}
      {/* <AnyWall /> */}
    </>
  )
}
