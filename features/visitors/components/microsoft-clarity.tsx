"use client"

import * as React from "react"
import Script from "next/script"

import { useConsent } from "@/features/visitors/hooks/use-consent"

declare global {
  interface Window {
    clarity?: (...args: unknown[]) => void
  }
}

const GRANTED = { ad_Storage: "granted", analytics_Storage: "granted" }
const DENIED = { ad_Storage: "denied", analytics_Storage: "denied" }

/**
 * Microsoft Clarity - heatmaps and session recordings - following the cookie
 * card through Clarity's consent API, as Google Analytics does.
 *
 * Left alone, Clarity sets its cookies on every visitor. So consent is denied
 * before the tag has even loaded (the call is queued and Clarity reads it
 * first): a visitor who has not accepted is recorded without cookies, each
 * page on its own. Accept lets Clarity set its cookies and stitch the visit
 * together; Decline, or taking an Accept back, turns them off again.
 *
 * Forms and pages carrying a name, phone, email or address are marked
 * data-clarity-mask, so recordings show their shape but not what was typed.
 */
export function MicrosoftClarity({ id }: { id: string }) {
  const consent = useConsent((s) => s.consent)
  const loaded = React.useRef(false)

  React.useEffect(() => {
    // On load the inline script has already applied the saved choice.
    if (!loaded.current) {
      loaded.current = true
      return
    }
    window.clarity?.("consentv2", consent === "granted" ? GRANTED : DENIED)
  }, [consent])

  return (
    <Script id="microsoft-clarity" strategy="afterInteractive">
      {`(function(c,l,a,r,i,t,y){
  c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
  var granted = false;
  try {
    var saved = JSON.parse(localStorage.getItem('skm.consent') || 'null');
    granted = !!(saved && saved.state && saved.state.consent === 'granted');
  } catch (e) {}
  c[a]('consentv2', granted ? ${JSON.stringify(GRANTED)} : ${JSON.stringify(DENIED)});
  t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
  y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
})(window, document, "clarity", "script", ${JSON.stringify(id)});`}
    </Script>
  )
}
