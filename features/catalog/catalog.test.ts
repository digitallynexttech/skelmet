import { describe, expect, it } from "vitest"

import { FAQ_ITEMS } from "@/components/marketing/content"
import { PISTON_SKULL_MOUNT, PRODUCTS } from "@/features/catalog/catalog"

// FAQ overrides are keyed by question text: a reworded question would silently restore a claim
// that is not true of that skull.
describe("product sections", () => {
  it("override only questions the FAQ asks", () => {
    const questions = FAQ_ITEMS.map((item) => item.question)
    for (const product of PRODUCTS) {
      for (const question of Object.keys(product.sections.faqAnswers ?? {})) {
        expect(questions).toContain(question)
      }
    }
  })

  // The owner confirmed full-face and open-face (2026-10-08), not modular, and no load rating yet.
  it("claim only what the owner has confirmed for the Piston Skull", () => {
    const { sections, specs } = PISTON_SKULL_MOUNT
    const answers = FAQ_ITEMS.flatMap((item) => {
      const own = sections.faqAnswers?.[item.question]
      return own === null ? [] : [own ?? item.answer]
    })
    const words = [sections.build.body, ...answers, ...specs.map((s) => `${s.label} ${s.value}`)]
    for (const text of words) {
      expect(text).not.toMatch(/10 kg|load rating/i)
      expect(text).not.toMatch(/modular/i)
    }
    expect(specs).toContainEqual({ label: "Fits", value: "Full-face and open-face" })
  })
})
