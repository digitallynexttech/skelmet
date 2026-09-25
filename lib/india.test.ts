import { describe, expect, it } from "vitest"

import { INDIAN_STATES, matchState, normalizeMobileInput } from "@/lib/india"

describe("matchState", () => {
  it("knows all 36 states and union territories by their own names", () => {
    expect(INDIAN_STATES).toHaveLength(36)
    for (const state of INDIAN_STATES) expect(matchState(state)).toBe(state)
  })

  it("reads Shiprocket's spellings, whatever the case", () => {
    expect(matchState("Delhi")).toBe("Delhi")
    expect(matchState("UTTARAKHAND")).toBe("Uttarakhand")
    expect(matchState("uttar pradesh")).toBe("Uttar Pradesh")
    expect(matchState("Jammu & Kashmir")).toBe("Jammu and Kashmir")
    expect(matchState("Andaman & Nicobar Islands")).toBe("Andaman and Nicobar Islands")
  })

  it("maps old names and the merged territories' halves", () => {
    expect(matchState("Orissa")).toBe("Odisha")
    expect(matchState("Pondicherry")).toBe("Puducherry")
    expect(matchState("New Delhi")).toBe("Delhi")
    expect(matchState("Daman & Diu")).toBe("Dadra and Nagar Haveli and Daman and Diu")
  })

  it("refuses anything that is not a state", () => {
    expect(matchState("hoihdlv")).toBeNull()
    expect(matchState("")).toBeNull()
    expect(matchState(null)).toBeNull()
  })
})

describe("normalizeMobileInput", () => {
  it("keeps a ten-digit number as it is", () => {
    expect(normalizeMobileInput("9876543210")).toBe("9876543210")
  })

  it("drops letters, spaces and symbols", () => {
    expect(normalizeMobileInput("98765 432a10")).toBe("9876543210")
    expect(normalizeMobileInput("abc")).toBe("")
  })

  it("takes the +91 or 0 off a pasted number", () => {
    expect(normalizeMobileInput("+91 98765 43210")).toBe("9876543210")
    expect(normalizeMobileInput("919876543210")).toBe("9876543210")
    expect(normalizeMobileInput("09876543210")).toBe("9876543210")
  })

  it("never lets an eleventh digit in", () => {
    // Typed, not pasted: the digit that would be eleventh is simply refused,
    // even when the number happens to start with 91.
    expect(normalizeMobileInput("98765432101")).toBe("9876543210")
    expect(normalizeMobileInput("91876543210")).toBe("9187654321")
  })
})
