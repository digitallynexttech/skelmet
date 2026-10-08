import { describe, expect, it } from "vitest"

import { FAQ_ITEMS } from "@/components/marketing/content"
import { PISTON_SKULL_MOUNT, PRODUCTS } from "@/features/catalog/catalog"

/**
 * Each skull's page shows the same sections with its own pictures and words.
 * A product's FAQ answers are keyed by the question's text, so a reworded
 * question would quietly drop the override - and put back a claim that is not
 * true of that skull.
 */
describe("product sections", () => {
  it("override only questions the FAQ asks", () => {
    const questions = FAQ_ITEMS.map((item) => item.question)
    for (const product of PRODUCTS) {
      for (const question of Object.keys(product.sections.faqAnswers ?? {})) {
        expect(questions).toContain(question)
      }
    }
  })

  it("claim no load rating or helmet fit for the Piston Skull until the owner confirms them", () => {
    const { sections, specs } = PISTON_SKULL_MOUNT
    const answers = FAQ_ITEMS.flatMap((item) => {
      const own = sections.faqAnswers?.[item.question]
      return own === null ? [] : [own ?? item.answer]
    })
    const words = [sections.build.body, ...answers, ...specs.map((s) => `${s.label} ${s.value}`)]
    for (const text of words) {
      expect(text).not.toMatch(/10 kg|load rating/i)
      expect(text).not.toMatch(/full-face|open-face|modular/i)
    }
  })
})
