import { Suspense } from "react"
import { Toaster } from "sonner"

import { FloatingActions } from "@/components/layout/floating-actions"
import { SiteFooter } from "@/components/layout/site-footer"
import { SiteHeader } from "@/components/layout/site-header"
import { SplashScreen } from "@/components/shared/splash-screen"
import { siteConfig } from "@/config/site"
import { ConsentBar } from "@/features/visitors/components/consent-bar"
import { CookieSettingsButton } from "@/features/visitors/components/cookie-settings-button"
import { GoogleAnalytics } from "@/features/visitors/components/google-analytics"
import { MicrosoftClarity } from "@/features/visitors/components/microsoft-clarity"
import { VisitTracker } from "@/features/visitors/components/visit-tracker"

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      {/* Mounted here rather than in the root layout so staff never sit through
          it on the way into /admin. This layout survives navigation between
          storefront routes, so the intro plays once per reload and no more. */}
      <SplashScreen />
      {/* Here for the same reason: it sees every storefront page, and none of
          the console's. It reads the search params, which need a boundary of
          their own or the whole storefront renders on the client. */}
      <Suspense fallback={null}>
        <VisitTracker />
      </Suspense>
      {/* Storefront only, and production builds only: the console and a
          developer's laptop are not visitors - and a recording of the console
          would be a recording of customers' orders. */}
      {process.env.NODE_ENV === "production" ? (
        <>
          <GoogleAnalytics id={siteConfig.googleAnalyticsId} />
          <MicrosoftClarity id={siteConfig.clarityProjectId} />
        </>
      ) : null}
      <SiteHeader />
      {/* Nothing in a page may make the document wider than the screen: a phone
          then lays out everything `fixed` - the splash, the cookie card, the
          floating buttons - against the wider page, off centre and partly off
          screen. It happens without anything looking wrong here: a one-line
          heading sized for the display face is wider in the fallback face
          until the font arrives. `clip`, not `hidden`, so `sticky` still
          works inside. */}
      <main className="flex-1 overflow-x-clip">{children}</main>
      <SiteFooter cookieSettings={<CookieSettingsButton />} />
      <FloatingActions />
      <ConsentBar />
      {/* Beside the floating buttons, not over them: they keep the 72px
          nearest the corner. On a phone a toast is full width and brief. */}
      <Toaster
        position="bottom-right"
        offset={{ right: 88 }}
        theme="dark"
        toastOptions={{
          style: {
            background: "var(--color-graphite)",
            border: "1px solid rgb(255 255 255 / 0.1)",
            color: "var(--color-bone)",
          },
        }}
      />
    </div>
  )
}
