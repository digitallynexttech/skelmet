import "server-only"

import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto"

/**
 * Seals console-saved secrets so a database dump does not carry them readable. AES-256-GCM with a
 * key derived from AUTH_SECRET: changing AUTH_SECRET makes every sealed value open to null, and
 * the site falls back to .env until each is re-entered. A tampered value also opens to null.
 */

const PREFIX = "sealed:v1:"

function key(): Buffer {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error("AUTH_SECRET is not set, so settings secrets cannot be sealed.")
  return Buffer.from(hkdfSync("sha256", secret, "skelmet", "settings-secrets-v1", 32))
}

export function seal(plain: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key(), iv)
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
  const parts = [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64url"))
  return `${PREFIX}${parts.join(".")}`
}

/** The secret, or null when it is not a sealed value or will not open. */
export function open(sealed: unknown): string | null {
  if (typeof sealed !== "string" || !sealed.startsWith(PREFIX)) return null
  const [iv, tag, data] = sealed
    .slice(PREFIX.length)
    .split(".")
    .map((part) => Buffer.from(part, "base64url"))
  if (!iv || !tag || !data || iv.length !== 12 || tag.length !== 16) return null
  try {
    const decipher = createDecipheriv("aes-256-gcm", key(), iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8")
  } catch {
    return null
  }
}
