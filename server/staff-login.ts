import "server-only"

import type { Permission } from "@/lib/constants"
import { hashPassword, needsRehash, verifyPassword, verifyPasswordOfNobody } from "@/lib/crypto"
import { clientIp, rateLimit } from "@/lib/rate-limit"
import { db } from "@/server/db"

/**
 * The console's sign-in check, called by the Credentials provider in
 * server/auth.ts. Every failure is the same `null`, which Auth.js turns into
 * the same opaque error, so nothing here tells a caller why.
 */

export type AuthorizedStaff = {
  id: string
  email: string
  name: string | null
  kind: "STAFF"
  roles: string[]
  permissions: Permission[]
  mustChangePassword: boolean
  sessionVersion: number
}

/**
 * Per address AND per account. The address limit alone let a botnet try an
 * account's password from a thousand addresses ten times each; the account
 * limit alone would let one address walk the whole staff list. A blocked
 * attempt is refused exactly like a wrong password.
 */
export const LOGIN_LIMITS = {
  perIp: { limit: 10, windowMs: 10 * 60_000 },
  perEmail: { limit: 10, windowMs: 15 * 60_000 },
} as const

export async function authorizeStaff(
  raw: Partial<Record<string, unknown>> | undefined,
  headers: Headers,
): Promise<AuthorizedStaff | null> {
  const email = typeof raw?.email === "string" ? raw.email.trim().toLowerCase() : ""
  const password = typeof raw?.password === "string" ? raw.password : ""
  if (!email || !password) return null
  // scrypt over a megabyte of "password" is a cheap way to make the server work.
  if (email.length > 254 || password.length > 1_024) return null

  try {
    rateLimit(`login:${clientIp(headers)}`, LOGIN_LIMITS.perIp.limit, LOGIN_LIMITS.perIp.windowMs)
    rateLimit(`login-email:${email}`, LOGIN_LIMITS.perEmail.limit, LOGIN_LIMITS.perEmail.windowMs)
  } catch {
    return null
  }

  const user = await db.user.findUnique({
    where: { email },
    // select overrides the global omit in server/db.ts, which is the one
    // place passwordHash is genuinely needed (§6).
    select: {
      id: true,
      email: true,
      name: true,
      kind: true,
      passwordHash: true,
      mustChangePassword: true,
      sessionVersion: true,
      roles: {
        select: {
          role: {
            select: {
              name: true,
              permissions: { select: { permission: { select: { scope: true } } } },
            },
          },
        },
      },
    },
  })

  // Only staff sign in: customers have rows here, made by checkout, but no
  // accounts. A missing user, a customer and a revoked member of staff are
  // all checked against a hash nobody matches, so the answer takes as long
  // as a wrong password - otherwise the timing alone says who has a login.
  if (!user || user.kind !== "STAFF" || !user.passwordHash) {
    await verifyPasswordOfNobody(password)
    return null
  }
  if (!(await verifyPassword(password, user.passwordHash))) return null

  // Hashes made before the cost was raised are rewritten while the password
  // is at hand. Best effort: failing to upgrade must not fail the sign-in.
  if (needsRehash(user.passwordHash)) {
    try {
      await db.user.update({
        where: { id: user.id },
        data: { passwordHash: await hashPassword(password) },
        select: { id: true },
      })
    } catch (err) {
      console.error("[AUTH] could not upgrade a password hash", err)
    }
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    kind: "STAFF",
    roles: user.roles.map((r) => r.role.name),
    permissions: [
      ...new Set(user.roles.flatMap((r) => r.role.permissions.map((p) => p.permission.scope))),
    ] as Permission[],
    mustChangePassword: user.mustChangePassword,
    sessionVersion: user.sessionVersion,
  }
}
