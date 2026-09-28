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

type ConsentState = {
  consent: Consent
  /** When they chose, so a changed policy can ask again. */
  decidedAt: string | null
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
      reviewing: false,
      choose: (consent) => set({ consent, decidedAt: new Date().toISOString(), reviewing: false }),
      review: () => set({ reviewing: true }),
      dismiss: () => set({ reviewing: false }),
    }),
    {
      name: "skm.consent",
      version: 1,
      partialize: (s) => ({ consent: s.consent, decidedAt: s.decidedAt }),
    },
  ),
)
