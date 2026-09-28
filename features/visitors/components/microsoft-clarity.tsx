"use client"

import * as React from "react"
import Script from "next/script"

import { useConsent } from "@/features/visitors/hooks/use-consent"
import { useHydrated } from "@/hooks/use-hydrated"

declare global {
  interface Window {
    clarity?: (...args: unknown[]) => void
  }
}

const GRANTED = { ad_Storage: "granted", analytics_Storage: "granted" }
const DENIED = { ad_Storage: "denied", analytics_Storage: "denied" }

/**
 * Microsoft Clarity - heatmaps and session recordings - for visitors who
 * accepted cookies, and nobody else.
 *
 * It used to load for everyone with its consent API set to "denied", which
 * keeps Clarity's own first-party cookies off but not the ones its tag sets
 * on clarity.ms and bing.com (CLID, MUID and others): eight third-party
 * cookies on a visitor who had not answered, contrary to what the cookie
 * card says. So the tag is not loaded at all until Accept. Taking an Accept
 * back turns Clarity's cookies off for the rest of that page, and it does not
 * load on the next.
 *
 * Forms and pages carrying a name, phone, email or address are marked
 * data-clarity-mask, so recordings show their shape but not what was typed.
 */
export function MicrosoftClarity({ id }: { id: string }) {
  const hydrated = useHydrated()
  const consent = useConsent((s) => s.consent)
  const granted = hydrated && consent === "granted"
  // Once loaded it stays loaded for this page; only its consent can change.
  const [load, setLoad] = React.useState(false)
  if (granted && !load) setLoad(true)

  React.useEffect(() => {
    if (!load) return
    window.clarity?.("consentv2", consent === "granted" ? GRANTED : DENIED)
  }, [load, consent])

  if (!load) return null
  return (
    <Script id="microsoft-clarity" strategy="lazyOnload">
      {`(function(c,l,a,r,i,t,y){
  c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
  c[a]('consentv2', ${JSON.stringify(GRANTED)});
  t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
  y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
})(window, document, "clarity", "script", ${JSON.stringify(id)});`}
    </Script>
  )
}
