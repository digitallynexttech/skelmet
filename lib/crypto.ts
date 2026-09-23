import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto"
import { promisify } from "node:util"

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>

const KEYLEN = 64

/**
 * scrypt from node:crypto rather than bcrypt/argon2 — no native dependency to
 * build on every platform, and it is the algorithm Node itself recommends.
 * Format: `scrypt$<saltHex>$<hashHex>`.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const hash = await scrypt(password, salt, KEYLEN)
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`
}

/** Constant-time compare — never a plain `===` on a secret (§6). */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltHex, hashHex] = stored.split("$")
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false

  const salt = Buffer.from(saltHex, "hex")
  const expected = Buffer.from(hashHex, "hex")
  const actual = await scrypt(password, salt, expected.length)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

/** Order numbers: SKM-2026-4F2K. Short, unambiguous, no 0/O/1/I. */
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"

export function shortCode(length = 4): string {
  const bytes = randomBytes(length)
  let out = ""
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i]! % ALPHABET.length]
  return out
}

export function orderNumber(now: Date): string {
  return `SKM-${now.getUTCFullYear()}-${shortCode(4)}`
}
