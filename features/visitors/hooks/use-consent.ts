"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

/**
 * The visitor's cookie choice, kept in this browser.
 *
 * - null: not asked yet. Visits are counted anonymously until they choose.
 * - "granted": remember this device between visits.
 * - "denied": keep counting visits anonymously, and nothing more.
 */
export type Consent = "granted" | "denied" | null

/**
 * What an Accept covers, as a number that goes up when it starts to cover
 * something new. 2 (2026-10-01): the Meta Pixel. An Accept given before
 * that still counts for what it covered then; the card asks again, and
 * anything newer waits until it is answered (see `acceptedNow`).
 */
export const CONSENT_REVISION = 2

type ConsentState = {
  consent: Consent
  /** When they chose, so a changed policy can ask again. */
  decidedAt: string | null
  /** CONSENT_REVISION when they chose; null for a choice made before revisions were kept. */
  revision: number | null
  /** The bar reopened from "Cookie settings" in the footer. Not kept. */
  reviewing: boolean
  choose: (consent: "granted" | "denied") => void
  review: () => void
  dismiss: () => void
}

export const useConsent = create<ConsentState>()(
  persist(
    (set) => ({
      consent: null,
      decidedAt: null,
      revision: null,
      reviewing: false,
      choose: (consent) =>
        set({
          consent,
          decidedAt: new Date().toISOString(),
          revision: CONSENT_REVISION,
          reviewing: false,
        }),
      review: () => set({ reviewing: true }),
      dismiss: () => set({ reviewing: false }),
    }),
    {
      name: "skm.consent",
      version: 1,
      partialize: (s) => ({ consent: s.consent, decidedAt: s.decidedAt, revision: s.revision }),
    },
  ),
)

/** An Accept that covers everything Accept covers today. */
export function acceptedNow(s: Pick<ConsentState, "consent" | "revision">): boolean {
  return s.consent === "granted" && (s.revision ?? 1) >= CONSENT_REVISION
}

/** Accepted before Accept covered what it does now: the card asks again. */
export function acceptedBefore(s: Pick<ConsentState, "consent" | "revision">): boolean {
  return s.consent === "granted" && (s.revision ?? 1) < CONSENT_REVISION
}
