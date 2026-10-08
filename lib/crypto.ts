import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto"

const scrypt = (password: string, salt: Buffer, keylen: number, options: ScryptOptions) =>
  new Promise<Buffer>((resolve, reject) =>
    scryptCb(password, salt, keylen, options, (err, key) => (err ? reject(err) : resolve(key))),
  )

const KEYLEN = 64

/**
 * OWASP's scrypt cost. Stored in each hash, so it can be raised later: old
 * hashes still verify and are rewritten at the next sign-in.
 */
export const SCRYPT_PARAMS = { log2N: 17, r: 8, p: 1 } as const

// Node caps scrypt at 32 MiB by default; N=2^17, r=8 needs 128 MiB.
const maxmemFor = (N: number, r: number) => 128 * N * r * 2

type Parsed = { log2N: number; r: number; p: number; salt: Buffer; hash: Buffer }

// `scrypt$17$8$1$<salt>$<hash>`, or legacy `scrypt$<salt>$<hash>` (N=2^14, r=8, p=1).
function parse(stored: string): Parsed | null {
  const parts = stored.split("$")
  if (parts[0] !== "scrypt") return null

  if (parts.length === 3) {
    const [, saltHex, hashHex] = parts
    if (!saltHex || !hashHex) return null
    return {
      log2N: 14,
      r: 8,
      p: 1,
      salt: Buffer.from(saltHex, "hex"),
      hash: Buffer.from(hashHex, "hex"),
    }
  }

  if (parts.length === 6) {
    const [, n, r, p, saltHex, hashHex] = parts
    const log2N = Number(n)
    const blockSize = Number(r)
    const parallel = Number(p)
    const sane = (v: number, max: number) => Number.isInteger(v) && v >= 1 && v <= max
    if (!sane(log2N, 20) || !sane(blockSize, 32) || !sane(parallel, 16)) return null
    if (!saltHex || !hashHex) return null
    return {
      log2N,
      r: blockSize,
      p: parallel,
      salt: Buffer.from(saltHex, "hex"),
      hash: Buffer.from(hashHex, "hex"),
    }
  }

  return null
}

function derive(
  password: string,
  salt: Buffer,
  keylen: number,
  log2N: number,
  r: number,
  p: number,
) {
  const N = 2 ** log2N
  return scrypt(password, salt, keylen, { N, r, p, maxmem: maxmemFor(N, r) })
}

/** node:crypto scrypt: no native dependency, unlike bcrypt or argon2. */
export async function hashPassword(password: string): Promise<string> {
  const { log2N, r, p } = SCRYPT_PARAMS
  const salt = randomBytes(16)
  const hash = await derive(password, salt, KEYLEN, log2N, r, p)
  return `scrypt$${log2N}$${r}$${p}$${salt.toString("hex")}$${hash.toString("hex")}`
}

/** Constant-time compare: never `===` on a secret. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parsed = parse(stored)
  if (!parsed || parsed.salt.length === 0 || parsed.hash.length === 0) return false

  const actual = await derive(
    password,
    parsed.salt,
    parsed.hash.length,
    parsed.log2N,
    parsed.r,
    parsed.p,
  )
  return parsed.hash.length === actual.length && timingSafeEqual(parsed.hash, actual)
}

/** Whether a hash that just verified should be rewritten at the current cost. */
export function needsRehash(stored: string): boolean {
  const parsed = parse(stored)
  if (!parsed) return true
  return (
    parsed.log2N !== SCRYPT_PARAMS.log2N ||
    parsed.r !== SCRYPT_PARAMS.r ||
    parsed.p !== SCRYPT_PARAMS.p ||
    parsed.hash.length !== KEYLEN
  )
}

// Matches no password. Unknown emails are checked against it so timing does
// not reveal which emails have a login.
const NOBODY = "scrypt$17$8$1$6e6f626f64792d686173682d73616c74$" + "0".repeat(KEYLEN * 2)

/** Takes as long as a real check, and always fails. */
export async function verifyPasswordOfNobody(password: string): Promise<false> {
  await verifyPassword(password, NOBODY)
  return false
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
