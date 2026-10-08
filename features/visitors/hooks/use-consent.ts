"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

/**
 * null: not asked yet, tracked as if granted. "denied": counted anonymously only; the
 * bar no longer saves it (consent-bar.tsx), so only earlier choices hold it.
 */
export type Consent = "granted" | "denied" | null

/**
 * Bumped when Accept starts to cover something new (2: the Meta Pixel). An
 * older Accept still covers what it did; the card asks again (`acceptedNow`).
 */
export const CONSENT_REVISION = 2

type ConsentState = {
  consent: Consent
  decidedAt: string | null
  /** CONSENT_REVISION when they chose; null for choices made before revisions. */
  revision: number | null
  /** Reopened from "Cookie settings". Not persisted. */
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

/** A current Accept, or an unasked visitor. */
export function acceptedNow(s: Pick<ConsentState, "consent" | "revision">): boolean {
  return s.consent !== "denied" && (s.consent === null || (s.revision ?? 1) >= CONSENT_REVISION)
}

/** An Accept older than CONSENT_REVISION: the card asks again. */
export function acceptedBefore(s: Pick<ConsentState, "consent" | "revision">): boolean {
  return s.consent === "granted" && (s.revision ?? 1) < CONSENT_REVISION
}
