import { Fragment } from "react"
import type { Metadata } from "next"

import { Anatomy } from "@/components/marketing/anatomy"
// import { AnyWall } from "@/components/marketing/any-wall"   // hidden from this page
import { Bento } from "@/components/marketing/bento"
import { ColourwayGrid } from "@/components/marketing/colourway-grid"
import { Comparison } from "@/components/marketing/comparison"
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
import { siteConfig } from "@/config/site"

export const metadata: Metadata = {
  // Absolute: the root layout's template appends " - SKELMET", which made
  // this "SKELMET - Park the menace - SKELMET".
  title: { absolute: `${siteConfig.name} - ${siteConfig.tagline}` },
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
 * would be the wrong trade for a marketing page carrying a 3D hero - a minute
 * of staleness on a price an admin just edited is the cheaper side.
 */
export const revalidate = 60

/**
 * A below-the-fold section the browser may skip laying out and painting until
 * it nears the viewport (content-visibility: auto). `size` is its rough height
 * in px, kept as a placeholder until it has rendered once, then remembered.
 * Only sections the flying skull never lands on: those it docks on are
 * measured on load and must be laid out.
 */
function Deferred({
  size,
  no,
  children,
}: {
  size: number
  /** This section's number in the page's run (see RUN). */
  no: number
  children: React.ReactNode
}) {
  // content-visibility brings style containment with it, and that walls CSS
  // counters in: a section inside started its own count, so four sections of
  // the home page were each "01". The outer box counts this section in the
  // page's sequence, so the ones after it carry on correctly. Inside, a box
  // of its own starts the count one short of this section's number, so its
  // label reads right - on the contained box itself Chrome ignores it.
  return (
    <div style={{ counterIncrement: "section" }}>
      <div style={{ contentVisibility: "auto", containIntrinsicSize: `auto ${size}px` }}>
        <div style={{ counterReset: `section ${no - 1}` }}>{children}</div>
      </div>
    </div>
  )
}

/**
 * The numbered sections, in order. Each carries one numbered label, which is
 * what makes the position in this list its number - 01 / THE LINEUP. A size
 * marks one to render late (Deferred).
 */
const RUN: { key: string; node: React.ReactNode; defer?: number }[] = [
  { key: "lineup", node: <ColourwayGrid /> },
  { key: "bento", node: <Bento />, defer: 720 },
  { key: "anatomy", node: <Anatomy /> },
  { key: "texture", node: <Texture /> },
  { key: "comparison", node: <Comparison />, defer: 880 },
  { key: "riders", node: <RiderWall />, defer: 760 },
  { key: "reviews", node: <Reviews /> },
  { key: "faq", node: <FaqSection />, defer: 820 },
  { key: "drop", node: <DropList /> },
]

export default function HomePage() {
  return (
    <>
      <Hero />
      <TrustStrip />
      {/* The eyebrow numbers come from this page's run (RUN), not from the
          sections - the same block is 05 here and 03 on the product page.
          Taking a section out is deleting its line from RUN. */}
      {/* No Suspense boundary, here or as a loading.tsx: the page is
          prerendered, so nobody waits on its database read. A boundary made
          the saved HTML open with its fallback and carry the real section at
          the end, swapped in by a script - on a slow connection the footer
          painted first and was then shoved down the screen (layout shift
          0.3-0.6), and the hero painted seconds late. */}
      {RUN.map((section, i) =>
        section.defer ? (
          <Deferred key={section.key} size={section.defer} no={i + 1}>
            {section.node}
          </Deferred>
        ) : (
          <Fragment key={section.key}>{section.node}</Fragment>
        ),
      )}

      {/* Hidden, not deleted - all five still render on other routes and are
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
