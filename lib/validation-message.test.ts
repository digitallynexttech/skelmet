import { describe, expect, it } from "vitest"
import { z } from "zod"

import { fieldErrorsOf, validationMessage } from "@/lib/validation-message"

const schema = z.object({
  code: z
    .string()
    .regex(/^[A-Z0-9-]{3,24}$/, "Letters, numbers and dashes only, 3 to 24 characters"),
  minSubtotal: z.number().min(0, "Cannot be negative"),
  address: z.object({ pincode: z.string().length(6, "Enter the 6-digit pincode") }),
})

const failure = (input: unknown) => {
  const parsed = schema.safeParse(input)
  if (parsed.success) throw new Error("expected a failure")
  return parsed.error
}

describe("validationMessage", () => {
  it("names the field and its own rule", () => {
    expect(
      validationMessage(failure({ code: "D", minSubtotal: 0, address: { pincode: "110044" } })),
    ).toBe("Code: letters, numbers and dashes only, 3 to 24 characters.")
  })

  it("names every field that failed, in words", () => {
    expect(
      validationMessage(failure({ code: "D", minSubtotal: -1, address: { pincode: "11" } })),
    ).toBe(
      "Code: letters, numbers and dashes only, 3 to 24 characters. Min subtotal: cannot be negative. Pincode: enter the 6-digit pincode.",
    )
  })
})

describe("fieldErrorsOf", () => {
  it("gives each top-level field its first message", () => {
    const flat = z.flattenError(
      failure({ code: "D", minSubtotal: -1, address: { pincode: "110044" } }),
    )
    expect(fieldErrorsOf(flat)).toEqual({
      code: "Letters, numbers and dashes only, 3 to 24 characters",
      minSubtotal: "Cannot be negative",
    })
  })

  it("is empty for anything that is not field errors", () => {
    expect(fieldErrorsOf(undefined)).toEqual({})
    expect(fieldErrorsOf("nope")).toEqual({})
  })
})
