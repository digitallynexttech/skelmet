import { describe, expect, it } from "vitest"

import { changePasswordSchema } from "@/features/account/schemas/password.schema"

describe("changePasswordSchema", () => {
  const ok = {
    currentPassword: "skelmet-dev",
    newPassword: "a-much-longer-one",
    confirmPassword: "a-much-longer-one",
  }

  it("accepts a valid change", () => {
    expect(changePasswordSchema.safeParse(ok).success).toBe(true)
  })

  it("rejects a confirmation that does not match, against confirmPassword", () => {
    const r = changePasswordSchema.safeParse({ ...ok, confirmPassword: "something-else" })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0]?.path).toEqual(["confirmPassword"])
  })

  it("rejects reusing the current password, against newPassword", () => {
    const r = changePasswordSchema.safeParse({
      currentPassword: "skelmet-dev",
      newPassword: "skelmet-dev",
      confirmPassword: "skelmet-dev",
    })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0]?.path).toEqual(["newPassword"])
  })

  it("enforces a minimum length", () => {
    expect(
      changePasswordSchema.safeParse({ ...ok, newPassword: "short", confirmPassword: "short" })
        .success,
    ).toBe(false)
  })
})
