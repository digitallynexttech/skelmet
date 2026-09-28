import "server-only"

import type { Session } from "next-auth"

import { hasDatabase } from "@/lib/env"
import { db } from "@/server/db"

/**
 * How long a console session lives, and what ends it early.
 *
 * Sessions are JWTs, so nothing on the server remembers them: a token stays
 * good until it expires, and every request re-signed it for another week. A
 * password reset, a revoke or a stolen laptop therefore changed nothing for a
 * session already open, and one used every few days never ended at all.
 *
 * Two claims fix that. `sessionVersion` is copied from the user's row at
 * sign-in; resetting or changing the password, revoking the account or taking
 * a role away bumps the row, and every token minted before it stops working.
 * `loginAt` is when the password was typed, and no amount of activity keeps a
 * session past SESSION_ABSOLUTE_MS from it.
 */

/** Idle timeout: the JWT's own maxAge, renewed by activity. */
export const SESSION_IDLE_SECONDS = 60 * 60 * 24 * 7

/** Absolute lifetime, from sign-in, however active the session. */
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

/**
 * Past its absolute lifetime - or with no sign-in time at all, which is a
 * token minted before these claims existed. Those are signed out once.
 */
export function outlived(loginAt: number | null, now: number = Date.now()): boolean {
  if (loginAt === null) return true
  // A sign-in time in the future is not one this server wrote.
  if (loginAt - now > 5 * 60_000) return true
  return now - loginAt > SESSION_ABSOLUTE_MS
}

/**
 * Whether a token read back from its cookie may go on being a session. The
 * jwt callback asks on every read, and a `false` makes Auth.js clear the
 * cookie - so a reset password or a revoke signs the browser out on its next
 * page, not a week later.
 *
 * A database that cannot be reached keeps the session: signing every member
 * of staff out over a blip would be worse, and the guards in action-guard.ts
 * check the same row again before any action, failing closed.
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
