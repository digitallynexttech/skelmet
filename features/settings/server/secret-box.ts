import "server-only"

import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto"

/**
 * Seals the secrets the console saves - payment keys, the Shiprocket password,
 * webhook secrets - before they reach the database, so a database dump or
 * backup does not carry them readable.
 *
 * AES-256-GCM, with a key derived from AUTH_SECRET rather than a variable of
 * its own: one fewer secret to lose. The catch is that changing AUTH_SECRET
 * makes every sealed value unreadable. open() then answers null, the console
 * says the saved value cannot be read, and until it is typed in again the
 * site falls back to .env as if it had never been saved.
 *
 * GCM authenticates as well as encrypts, so a sealed value that was edited in
 * the database opens to null, never to something else.
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
