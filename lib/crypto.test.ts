import { randomBytes, scryptSync } from "node:crypto"

import { describe, expect, it } from "vitest"

import {
  hashPassword,
  needsRehash,
  SCRYPT_PARAMS,
  verifyPassword,
  verifyPasswordOfNobody,
} from "@/lib/crypto"

/** Legacy format, Node's default cost. */
function legacyHash(password: string): string {
  const salt = randomBytes(16)
  return `scrypt$${salt.toString("hex")}$${scryptSync(password, salt, 64).toString("hex")}`
}

describe("hashPassword", () => {
  it("stores the cost it was made with", async () => {
    const stored = await hashPassword("correct horse battery")
    const [scheme, n, r, p, salt, hash] = stored.split("$")
    expect([scheme, n, r, p]).toEqual([
      "scrypt",
      String(SCRYPT_PARAMS.log2N),
      String(SCRYPT_PARAMS.r),
      String(SCRYPT_PARAMS.p),
    ])
    expect(salt).toHaveLength(32)
    expect(hash).toHaveLength(128)
    expect(SCRYPT_PARAMS).toEqual({ log2N: 17, r: 8, p: 1 })
  })

  it("verifies its own hashes and refuses the wrong password", async () => {
    const stored = await hashPassword("correct horse battery")
    expect(await verifyPassword("correct horse battery", stored)).toBe(true)
    expect(await verifyPassword("correct horse batterY", stored)).toBe(false)
    expect(needsRehash(stored)).toBe(false)
  })
})

describe("verifyPassword with the original format", () => {
  it("still verifies, and asks to be rewritten", async () => {
    const stored = legacyHash("old but good")
    expect(await verifyPassword("old but good", stored)).toBe(true)
    expect(await verifyPassword("old but bad", stored)).toBe(false)
    expect(needsRehash(stored)).toBe(true)
  })

  it("refuses malformed hashes without throwing", async () => {
    for (const stored of [
      "",
      "bcrypt$x$y",
      "scrypt$$",
      "scrypt$99$8$1$aa$bb",
      "scrypt$a$b$c$d$e",
    ]) {
      expect(await verifyPassword("anything", stored)).toBe(false)
    }
  })
})

describe("verifyPasswordOfNobody", () => {
  it("always fails", async () => {
    expect(await verifyPasswordOfNobody("")).toBe(false)
    expect(await verifyPasswordOfNobody("correct horse battery")).toBe(false)
  })
})
