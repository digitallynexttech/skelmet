import "server-only"

import type { Permission } from "@/lib/constants"
import { hashPassword, needsRehash, verifyPassword, verifyPasswordOfNobody } from "@/lib/crypto"
import { clientIp, rateLimit } from "@/lib/rate-limit"
import { db } from "@/server/db"

// Security: every failure is the same `null`, so a caller never learns why.

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

/** Per IP and per account (each alone is beatable); blocked looks like a wrong password. */
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
  // Huge inputs would make scrypt cheap DoS.
  if (email.length > 254 || password.length > 1_024) return null

  try {
    rateLimit(`login:${clientIp(headers)}`, LOGIN_LIMITS.perIp.limit, LOGIN_LIMITS.perIp.windowMs)
    rateLimit(`login-email:${email}`, LOGIN_LIMITS.perEmail.limit, LOGIN_LIMITS.perEmail.windowMs)
  } catch {
    return null
  }

  const user = await db.user.findUnique({
    where: { email },
    // Overrides db.ts's global omit: the one place passwordHash is needed.
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

  // Only staff sign in. Non-staff still pay a hash check, so timing does not
  // reveal who has a login.
  if (!user || user.kind !== "STAFF" || !user.passwordHash) {
    await verifyPasswordOfNobody(password)
    return null
  }
  if (!(await verifyPassword(password, user.passwordHash))) return null

  // Best effort: a failed upgrade must not fail the sign-in.
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
