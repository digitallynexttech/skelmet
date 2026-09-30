import { describe, expect, it } from "vitest"
import { z } from "zod"

import "@/server/zod-messages"
import { validationMessage } from "@/lib/validation-message"

const fail = (schema: z.ZodType, input: unknown) => {
  const parsed = schema.safeParse(input)
  if (parsed.success) throw new Error("expected a failure")
  return validationMessage(parsed.error)
}

describe("plain messages for rules without their own", () => {
  it("says what a number has to be", () => {
    expect(fail(z.object({ minSubtotal: z.coerce.number().min(0) }), { minSubtotal: -5 })).toBe(
      "Min subtotal: must be 0 or more.",
    )
    expect(fail(z.object({ qty: z.number().int().max(9) }), { qty: 12 })).toBe("Qty: 9 at most.")
  })

  it("says a missing field is required, and a bad email is not an email", () => {
    expect(fail(z.object({ name: z.string().min(1) }), { name: "" })).toBe("Name: required.")
    expect(fail(z.object({ email: z.email() }), { email: "nope" })).toBe(
      "Email: not a valid email address.",
    )
  })

  it("leaves a rule's own message alone", () => {
    expect(fail(z.object({ code: z.string().min(3, "Three at least") }), { code: "D" })).toBe(
      "Code: three at least.",
    )
  })
})
