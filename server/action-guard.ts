import "server-only"

import type { Session } from "next-auth"

import { FULL_ACCESS_ROLES, type Permission } from "@/lib/constants"
import { hasDatabase } from "@/lib/env"
import { ForbiddenError, UnauthorizedError } from "@/lib/errors"
import { auth } from "@/server/auth"
import { db } from "@/server/db"
import { outlived, sessionClaims } from "@/server/session-policy"

// Guards are called by services, not routes. With proxy.ts, the enforcement.

export async function requireSession(): Promise<Session> {
  const session = await auth()
  if (!session?.user?.id) throw new UnauthorizedError()
  return session
}

const SESSION_ENDED = "Your session has ended. Sign in again."

export const MUST_CHANGE_PASSWORD =
  "Set a new password before you carry on: your account is still on the temporary one. Go to /change-password."

/**
 * Kind, roles, permissions and password flag read fresh from the database, so a
 * revoke takes effect at once; a stale `sessionVersion` answers 401.
 */
async function withLiveAccess(session: Session): Promise<Session> {
  if (!hasDatabase()) return session

  const claims = sessionClaims(session)
  if (claims.sessionVersion === null || outlived(claims.loginAt)) {
    throw new UnauthorizedError(SESSION_ENDED)
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      kind: true,
      sessionVersion: true,
      mustChangePassword: true,
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
  if (!user) throw new UnauthorizedError()
  if (user.sessionVersion !== claims.sessionVersion) throw new UnauthorizedError(SESSION_ENDED)

  session.user.kind = user.kind
  session.user.roles = user.roles.map((r) => r.role.name)
  session.user.permissions = [
    ...new Set(user.roles.flatMap((r) => r.role.permissions.map((p) => p.permission.scope))),
  ] as Permission[]
  session.user.mustChangePassword = user.mustChangePassword
  return session
}

/** On a temporary password (`mustChangePassword`), the API allows only changing it. */
export async function requireStaff(
  options: { allowPendingPasswordChange?: boolean } = {},
): Promise<Session> {
  const session = await withLiveAccess(await requireSession())
  if (session.user.kind !== "STAFF") {
    // 404, not 403: a customer must not probe what exists.
    throw new ForbiddenError("Not found.")
  }
  if (session.user.mustChangePassword && !options.allowPendingPasswordChange) {
    throw new ForbiddenError(MUST_CHANGE_PASSWORD)
  }
  return session
}

/** For the staff layout, which redirects instead of throwing. */
export async function staffSession(): Promise<Session | null> {
  const session = await auth()
  if (!session?.user?.id) return null
  try {
    return await withLiveAccess(session)
  } catch {
    return null
  }
}

export async function requirePermission(scope: Permission): Promise<Session> {
  const session = await requireStaff()
  if (!session.user.permissions.includes(scope)) {
    throw new ForbiddenError("You do not have access to that.")
  }
  return session
}

export function hasFullAccess(session: Session | null): boolean {
  const full = FULL_ACCESS_ROLES.map((r) => r.toLowerCase())
  return Boolean(session?.user?.roles?.some((r) => full.includes(r.toLowerCase())))
}

/** For what no single permission should reach, e.g. deleting orders. */
export async function requireFullAccess(): Promise<Session> {
  const session = await requireStaff()
  if (!hasFullAccess(session)) {
    throw new ForbiddenError("Only an owner or admin can do that.")
  }
  return session
}

export async function optionalSession(): Promise<Session | null> {
  return auth()
}

export function can(session: Session | null, scope: Permission): boolean {
  return Boolean(session?.user?.permissions?.includes(scope))
}
