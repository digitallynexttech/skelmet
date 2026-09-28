import { describe, expect, it } from "vitest"

import { FAQ_ITEMS } from "@/components/marketing/content"
import { POLICIES, getPolicy, type Policy } from "@/features/policies/policies"

/** Every sentence a customer can read on a policy page, links flattened to their text. */
function allText(policy: Policy): string[] {
  const out = [policy.title, policy.intro, policy.shortVersion]
  for (const section of policy.sections) {
    out.push(section.title)
    for (const block of section.blocks) {
      if (block.type === "p") {
        out.push(
          typeof block.text === "string"
            ? block.text
            : block.text.map((part) => (typeof part === "string" ? part : part.text)).join(""),
        )
      } else if (block.type === "list") {
        out.push(...block.items)
      } else if (block.type === "table") {
        out.push(...block.head, ...block.rows.flat())
      }
    }
  }
  return out
}

const policies = [
  ...POLICIES,
  // The shipping policy as it reads under a free-everywhere rule, too.
  getPolicy("shipping", { aboveRupees: 0, sharePercent: 0 })!,
]

describe("policies", () => {
  it("carry no [bracketed] placeholders", () => {
    for (const policy of policies) {
      for (const text of allText(policy)) expect(text).not.toMatch(/\[[^\]]*\]/)
    }
  })

  it("say a real date and version", () => {
    for (const policy of POLICIES) {
      expect(policy.updated).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(policy.version).toMatch(/^\d+\.\d+$/)
    }
  })

  it("never promise WhatsApp tracking or customer accounts that do not exist", () => {
    for (const policy of policies) {
      for (const text of allText(policy)) {
        expect(text).not.toMatch(/WhatsApp message/i)
        expect(text).not.toMatch(/(from|create|delete) (your|an) account/i)
      }
    }
  })

  it("give transit damage the same 24-hour window as the FAQ", () => {
    const policyText = policies.flatMap(allText).join(" ")
    const faqText = FAQ_ITEMS.map((i) => i.answer).join(" ")
    for (const text of [policyText, faqText]) {
      expect(text).toContain("within 24 hours of delivery")
      expect(text).not.toMatch(/within 48 hours of delivery/)
    }
  })
})
