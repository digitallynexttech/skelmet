"use client"

import * as React from "react"
import Script from "next/script"

import { useConsent } from "@/features/visitors/hooks/use-consent"
import { afterFirstInteraction } from "@/lib/first-interaction"

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

const GRANTED = {
  ad_storage: "granted",
  ad_user_data: "granted",
  ad_personalization: "granted",
  analytics_storage: "granted",
}

const DENIED = {
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
  analytics_storage: "denied",
}

/**
 * GA4 through Google's consent mode: granted unless the saved choice is "denied" (then no
 * cookies, cookieless pings only). The inline script applies the saved choice (use-consent's
 * persisted store) before `config`, so it holds from the first page.
 */
export function GoogleAnalytics({ id }: { id: string }) {
  const consent = useConsent((s) => s.consent)
  const loaded = React.useRef(false)
  // gtag.js (170 KB) waits for the first interaction; the stub queues calls until then.
  const [library, setLibrary] = React.useState(false)
  React.useEffect(() => afterFirstInteraction(() => setLibrary(true)), [])

  React.useEffect(() => {
    // On load the inline script already applied the saved choice.
    if (!loaded.current) {
      loaded.current = true
      return
    }
    window.gtag?.("consent", "update", consent !== "denied" ? GRANTED : DENIED)
  }, [consent])

  return (
    <>
      <Script id="google-analytics" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
window.gtag = gtag;
gtag('consent', 'default', ${JSON.stringify(GRANTED)});
try {
  var saved = JSON.parse(localStorage.getItem('skm.consent') || 'null');
  if (saved && saved.state && saved.state.consent === 'denied') {
    gtag('consent', 'update', ${JSON.stringify(DENIED)});
  }
} catch (e) {}
gtag('js', new Date());
gtag('config', ${JSON.stringify(id)});`}
      </Script>
      {library ? (
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`}
          strategy="afterInteractive"
        />
      ) : null}
    </>
  )
}
