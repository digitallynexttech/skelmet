import "server-only"

import type { Session } from "next-auth"

import { hasDatabase } from "@/lib/env"
import { db } from "@/server/db"

// JWT sessions live on the client, so two claims end them: `sessionVersion`
// (bumped by a password change, revoke or role removal) and `loginAt` (caps
// the session at SESSION_ABSOLUTE_MS however active).

/** Idle timeout: the JWT's maxAge, renewed by activity. */
export const SESSION_IDLE_SECONDS = 60 * 60 * 24 * 7

export const SESSION_ABSOLUTE_MS = 30 * 24 * 60 * 60_000

export type SessionClaims = { sessionVersion: number | null; loginAt: number | null }

const numberOrNull = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : null

export function claimsOf(source: Record<string, unknown> | null | undefined): SessionClaims {
  return {
    sessionVersion: numberOrNull(source?.sessionVersion),
    loginAt: numberOrNull(source?.loginAt),
  }
}

/** The claims the session callback copied onto `session.user`. */
export function sessionClaims(session: Session): SessionClaims {
  return claimsOf(session.user as unknown as Record<string, unknown>)
}

/** Past its absolute lifetime, or with no sign-in time at all. */
export function outlived(loginAt: number | null, now: number = Date.now()): boolean {
  if (loginAt === null) return true
  // A sign-in time in the future is not one this server wrote.
  if (loginAt - now > 5 * 60_000) return true
  return now - loginAt > SESSION_ABSOLUTE_MS
}

/**
 * Asked by the jwt callback on every read; `false` clears the cookie. An
 * unreachable database keeps the session: action-guard.ts fails closed anyway.
 */
export async function tokenStillValid(
  token: Record<string, unknown>,
  now: number = Date.now(),
): Promise<boolean> {
  const { sessionVersion, loginAt } = claimsOf(token)
  if (outlived(loginAt, now)) return false
  if (typeof token.id !== "string" || sessionVersion === null) return false
  if (!hasDatabase()) return true

  try {
    const user = await db.user.findUnique({
      where: { id: token.id },
      select: { kind: true, sessionVersion: true },
    })
    return Boolean(user && user.kind === "STAFF" && user.sessionVersion === sessionVersion)
  } catch (err) {
    console.error("[AUTH] could not check the session against the database", err)
    return true
  }
}
