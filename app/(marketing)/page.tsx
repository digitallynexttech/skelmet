import type { Metadata } from "next"

import { Anatomy } from "@/components/marketing/anatomy"
import { AnyWall } from "@/components/marketing/any-wall"
import { Bento } from "@/components/marketing/bento"
import { ColourwayGrid } from "@/components/marketing/colourway-grid"
import { Comparison } from "@/components/marketing/comparison"
import { TICKER_ITEMS } from "@/components/marketing/content"
import { DropList } from "@/components/marketing/drop-list"
import { FaqSection } from "@/components/marketing/faq-section"
import { Gifting } from "@/components/marketing/gifting"
import { Hero } from "@/components/marketing/hero"
import { InstallSteps } from "@/components/marketing/install-steps"
import { ReelStrip } from "@/components/marketing/reel-strip"
import { Reviews } from "@/components/marketing/reviews"
import { RiderWall } from "@/components/marketing/rider-wall"
import { Texture } from "@/components/marketing/texture"
import { TheHook } from "@/components/marketing/the-hook"
import { ThePoint } from "@/components/marketing/the-point"
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
export default function HomePage() {
  return (
    <>
      <Hero />
      <MarqueeTicker items={TICKER_ITEMS} />
      <TrustStrip />
      <ColourwayGrid />
      <ThePoint />
      <Anatomy />
      <Texture />
      <Bento />
      <InstallSteps />
      <Comparison />
      <TheHook />
      <ReelStrip />
      <RiderWall />
      <Reviews />
      <AnyWall />
      <Gifting />
      <FaqSection />
      <DropList />
    </>
  )
}
