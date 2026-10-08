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
 * Loads unless the saved choice is "denied" (so also before any choice); with "denied"
 * it never loads, as its tag sets third-party cookies (CLID, MUID) even then.
 * Personal details are hidden from recordings with data-clarity-mask.
 */
export function MicrosoftClarity({ id }: { id: string }) {
  const hydrated = useHydrated()
  const consent = useConsent((s) => s.consent)
  const granted = hydrated && consent !== "denied"
  // Once loaded it stays for this page; only its consent can change.
  const [load, setLoad] = React.useState(false)
  if (granted && !load) setLoad(true)

  React.useEffect(() => {
    if (!load) return
    window.clarity?.("consentv2", consent !== "denied" ? GRANTED : DENIED)
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
