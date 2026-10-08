import { Fragment } from "react"
import type { Metadata } from "next"

import { Anatomy } from "@/components/marketing/anatomy"
import { Bento } from "@/components/marketing/bento"
import { Comparison } from "@/components/marketing/comparison"
import { DropList } from "@/components/marketing/drop-list"
import { FaqSection } from "@/components/marketing/faq-section"
import { Hero } from "@/components/marketing/hero"
import { Lineup } from "@/components/marketing/lineup"
// import { InstallSteps } from "@/components/marketing/install-steps"   // hidden from this page
import { Reviews } from "@/components/marketing/reviews"
import { RiderWall } from "@/components/marketing/rider-wall"
import { Texture } from "@/components/marketing/texture"
import { TrustStrip } from "@/components/marketing/trust-strip"
import { siteConfig } from "@/lib/config/site"

export const metadata: Metadata = {
  // Absolute: the root layout's title template would add " - SKELMET" twice.
  title: { absolute: `${siteConfig.name} - ${siteConfig.tagline}` },
  description: siteConfig.description,
  alternates: { canonical: "/" },
}

// Server component on purpose (static marketing); only interactive leaves ship JS.
// Revalidated each minute so the lineup's live prices match the product page and checkout.
export const revalidate = 60

/**
 * A below-the-fold section rendered lazily (content-visibility: auto); `size` is its
 * rough height in px. Never for a section the flying skull docks on: those are measured on load.
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
  // content-visibility's style containment walls in CSS counters: the outer box keeps the
  // page count, the inner one resets to this section's number (Chrome ignores it on the
  // contained box itself).
  return (
    <div style={{ counterIncrement: "section" }}>
      <div style={{ contentVisibility: "auto", containIntrinsicSize: `auto ${size}px` }}>
        <div style={{ counterReset: `section ${no - 1}` }}>{children}</div>
      </div>
    </div>
  )
}

/** The numbered sections: position here is the label's number. `defer` renders it late (Deferred). */
const RUN: { key: string; node: React.ReactNode; defer?: number }[] = [
  { key: "lineup", node: <Lineup /> },
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
      {/* No Suspense or loading.tsx: the page is prerendered, and a boundary
          streams the sections after the footer (CLS 0.3-0.6). */}
      {RUN.map((section, i) =>
        section.defer ? (
          <Deferred key={section.key} size={section.defer} no={i + 1}>
            {section.node}
          </Deferred>
        ) : (
          <Fragment key={section.key}>{section.node}</Fragment>
        ),
      )}

      {/* Hidden, not deleted: to restore one, add it to RUN. */}
      {/* <InstallSteps /> */}
    </>
  )
}
