import { Suspense } from "react"

import { FloatingActions } from "@/components/layout/floating-actions"
import { SiteFooter } from "@/components/layout/site-footer"
import { SiteHeader } from "@/components/layout/site-header"
import { TICKER_ITEMS } from "@/components/marketing/content"
import { MarqueeTicker } from "@/components/shared/marquee-ticker"
import { SplashScreen } from "@/components/shared/splash-screen"
import { siteConfig } from "@/lib/config/site"
import { CartDrawer } from "@/features/cart/components/cart-drawer"
import { ConsentBar } from "@/features/visitors/components/consent-bar"
import { CookieSettingsButton } from "@/features/visitors/components/cookie-settings-button"
import { GoogleAnalytics } from "@/features/visitors/components/google-analytics"
import { MetaPixel } from "@/features/visitors/components/meta-pixel"
import { MicrosoftClarity } from "@/features/visitors/components/microsoft-clarity"
import { VisitTracker } from "@/features/visitors/components/visit-tracker"

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      {/* Here, not in the root layout: storefront only, and once per reload. */}
      <SplashScreen />
      {/* Reads search params, so it needs its own boundary or the storefront renders on the client. */}
      <Suspense fallback={null}>
        <VisitTracker />
      </Suspense>
      {/* Storefront and production only: never record the console (customers' orders). */}
      {process.env.NODE_ENV === "production" ? (
        <>
          <GoogleAnalytics id={siteConfig.googleAnalyticsId} />
          <MicrosoftClarity id={siteConfig.clarityProjectId} />
          <MetaPixel />
        </>
      ) : null}
      {/* 36px tall: hero.tsx and the thank-you page subtract it from their first screen. */}
      <MarqueeTicker items={TICKER_ITEMS} slim />
      <SiteHeader />
      {/* Clips sideways overflow: a wider page puts every `fixed` element off centre on
          phones. `clip`, not `hidden`, so `sticky` still works inside. */}
      <main className="flex-1 overflow-x-clip">{children}</main>
      <SiteFooter cookieSettings={<CookieSettingsButton />} />
      <FloatingActions />
      <ConsentBar />
      <CartDrawer />
    </div>
  )
}
