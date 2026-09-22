import { Toaster } from "sonner"

import { SiteFooter } from "@/components/layout/site-footer"
import { SiteHeader } from "@/components/layout/site-header"
import { SplashScreen } from "@/components/shared/splash-screen"

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      {/* Mounted here rather than in the root layout so staff never sit through
          it on the way into /admin. This layout survives navigation between
          storefront routes, so the intro plays once per reload and no more. */}
      <SplashScreen />
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
      <Toaster
        position="bottom-right"
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
