"use client"

import Link from "next/link"
import { Cookie, X } from "lucide-react"

import { acceptedBefore, useConsent } from "@/features/visitors/hooks/use-consent"
import { reportConsent } from "@/features/visitors/lib/tracker"
import { useHydrated } from "@/hooks/use-hydrated"

/**
 * The cookie choice, asked once and changeable from "Cookie settings" in the
 * footer - which is what the privacy policy promises.
 *
 * Short on purpose: the card says why, and "Read more" goes to the privacy
 * policy's cookie section, which lists what is kept. Both buttons do what
 * they say. Accept: this device is remembered between visits. Decline: the
 * visit is still counted, without the IP address, without a cookie, and
 * without being tied to anyone.
 */
export function ConsentBar() {
  const hydrated = useHydrated()
  const consent = useConsent((s) => s.consent)
  const reviewing = useConsent((s) => s.reviewing)
  // Accepted before Accept covered what it does now (the Meta Pixel): asked
  // again, with the old Accept standing for what it covered until then.
  const outdated = useConsent(acceptedBefore)
  const choose = useConsent((s) => s.choose)
  const dismiss = useConsent((s) => s.dismiss)

  // The choice lives in localStorage, which the server render cannot see.
  if (!hydrated || (consent !== null && !reviewing && !outdated)) return null

  const pick = (next: "granted" | "denied") => {
    const previous = useConsent.getState().consent
    choose(next)
    reportConsent(next, previous)
  }

  return (
    <div
      role="region"
      aria-labelledby="cookie-consent-title"
      className="fixed inset-x-3 bottom-3 z-[60] sm:inset-x-auto sm:bottom-5 sm:left-5 sm:w-[400px]"
    >
      {/* Opaque rather than blurred below sm: on a phone it sits over the
          scrolling page, and a blur there is recomputed on every frame. */}
      <div className="bg-graphite sm:bg-graphite/95 rounded-tile relative border border-white/[0.12] p-6 shadow-[0_24px_60px_rgb(0_0_0_/_0.55)] sm:backdrop-blur-xl">
        {reviewing ? (
          <button
            type="button"
            onClick={dismiss}
            aria-label="Close"
            className="text-dim hover:text-bone absolute top-3 right-3 flex size-9 items-center justify-center transition-colors"
          >
            <X className="size-4" strokeWidth={2} />
          </button>
        ) : null}

        <div className="mb-3.5 flex items-center gap-3">
          <Cookie className="text-blaze size-7 shrink-0" strokeWidth={1.8} aria-hidden />
          <h2 id="cookie-consent-title" className="text-blaze text-[21px] font-semibold">
            Cookie Consent
          </h2>
        </div>

        <p className="text-ash text-[14.5px] leading-[1.6]">
          We use cookies to give you a better shopping experience and to remind you about anything
          you leave in your cart.{" "}
          <Link
            href="/policies/privacy#s-06"
            className="text-blaze hover:text-ember font-medium transition-colors"
          >
            How we use cookies
          </Link>
        </p>

        {reviewing && consent ? (
          <p className="text-dim mt-3 text-[12.5px]">
            You {consent === "granted" ? "accepted" : "declined"} cookies. You can change that here.
          </p>
        ) : outdated ? (
          <p className="text-dim mt-3 text-[12.5px]">
            Accept now also turns on Meta&apos;s ad pixel. Your earlier choice stands until you pick
            again.
          </p>
        ) : null}

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => pick("granted")}
            className="bg-blaze text-void hover:bg-ember rounded-field h-11 text-[14.5px] font-semibold transition-colors"
          >
            Accept
          </button>
          <button
            type="button"
            onClick={() => pick("granted")}
            className="border-blaze text-blaze hover:bg-blaze/10 rounded-field h-11 border text-[14.5px] font-semibold transition-colors"
          >
            Decline
          </button>
        </div>
      </div>
    </div>
  )
}
