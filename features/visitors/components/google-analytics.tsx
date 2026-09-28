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
 * Google Analytics 4 (gtag.js), following the cookie card through Google's
 * consent mode - the same promise the rest of the tracking keeps.
 *
 * Every visit is measured. Until a visitor accepts, consent is "denied":
 * Google Analytics sets no cookies and sends cookieless pings, which Google
 * models into its reports without recognising anyone. Accept turns on its
 * cookies and the ad measurement that remarketing needs; Decline, or taking
 * an Accept back, turns them off again.
 *
 * The saved choice is read by the same inline script that sets the default,
 * before the `config` line, so a returning visitor who accepted is measured
 * in full from their first page rather than from whenever React hydrates.
 * The key and shape are use-consent's zustand store as persisted.
 */
export function GoogleAnalytics({ id }: { id: string }) {
  const consent = useConsent((s) => s.consent)
  const loaded = React.useRef(false)
  // gtag.js - 170 KB, much of it unused on a first page - waits for the
  // visitor to do something. The stub below queues every call into dataLayer
  // until then, so the page view and consent state still reach Google.
  const [library, setLibrary] = React.useState(false)
  React.useEffect(() => afterFirstInteraction(() => setLibrary(true)), [])

  React.useEffect(() => {
    // On load the inline script has already applied the saved choice.
    if (!loaded.current) {
      loaded.current = true
      return
    }
    window.gtag?.("consent", "update", consent === "granted" ? GRANTED : DENIED)
  }, [consent])

  return (
    <>
      <Script id="google-analytics" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
window.gtag = gtag;
gtag('consent', 'default', ${JSON.stringify(DENIED)});
try {
  var saved = JSON.parse(localStorage.getItem('skm.consent') || 'null');
  if (saved && saved.state && saved.state.consent === 'granted') {
    gtag('consent', 'update', ${JSON.stringify(GRANTED)});
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
