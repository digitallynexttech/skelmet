import "server-only"

import type { Session } from "next-auth"

import type { Permission } from "@/lib/constants"
import { hasDatabase } from "@/lib/env"
import { ForbiddenError, UnauthorizedError } from "@/lib/errors"
import { auth } from "@/server/auth"
import { db } from "@/server/db"
import { outlived, sessionClaims } from "@/server/session-policy"

/**
 * Guards live inside the service, not the route (§5). Hiding a nav item is
 * cosmetic; these and proxy.ts are the enforcement.
 */

export async function requireSession(): Promise<Session> {
  const session = await auth()
  if (!session?.user?.id) throw new UnauthorizedError()
  return session
}

const SESSION_ENDED = "Your session has ended. Sign in again."

export const MUST_CHANGE_PASSWORD =
  "Set a new password before you carry on: your account is still on the temporary one. Go to /change-password."

/**
 * The session with its kind, roles, permissions and password flag read fresh
 * from the database, overwriting what the token remembers.
 *
 * The token is a snapshot taken at login. Trusting it meant revoking a staff
 * member, or taking a role away, changed nothing until their token expired.
 * One small query per staff action is the price of revocation that actually
 * revokes. The same row carries `sessionVersion`, which a password reset or
 * change, a revoke or a role removal bumps: a token from before that answers
 * 401 here even if its cookie is still in the browser.
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
  // Deleted outright: nobody to act as.
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

/**
 * A current member of staff. While their account is on a temporary password
 * (`mustChangePassword`), only changing it is allowed: the (app) layout sends
 * pages to /change-password, and this is the same rule for the API - which
 * the layout never sees, so a temporary password used to work for every
 * endpoint in the console.
 */
export async function requireStaff(
  options: { allowPendingPasswordChange?: boolean } = {},
): Promise<Session> {
  const session = await withLiveAccess(await requireSession())
  if (session.user.kind !== "STAFF") {
    // 404, not 403 - a customer must not be able to probe what exists (§6).
    throw new ForbiddenError("Not found.")
  }
  if (session.user.mustChangePassword && !options.allowPendingPasswordChange) {
    throw new ForbiddenError(MUST_CHANGE_PASSWORD)
  }
  return session
}

/**
 * The staff shell's gate: a live session for a current staff member, or null.
 * For the layout, which redirects rather than throwing - and which reads
 * `mustChangePassword`, fresh from the database, to send them to set one.
 */
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

/** Null instead of a throw, for pages that render differently when signed out. */
export async function optionalSession(): Promise<Session | null> {
  return auth()
}

export function can(session: Session | null, scope: Permission): boolean {
  return Boolean(session?.user?.permissions?.includes(scope))
}
