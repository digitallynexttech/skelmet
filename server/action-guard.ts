import "server-only"

import type { Session } from "next-auth"

import type { Permission } from "@/lib/constants"
import { hasDatabase } from "@/lib/env"
import { ForbiddenError, UnauthorizedError } from "@/lib/errors"
import { auth } from "@/server/auth"
import { db } from "@/server/db"

/**
 * Guards live inside the service, not the route (§5). Hiding a nav item is
 * cosmetic; these and proxy.ts are the enforcement.
 */

export async function requireSession(): Promise<Session> {
  const session = await auth()
  if (!session?.user?.id) throw new UnauthorizedError()
  return session
}

/**
 * The session with its kind, roles and permissions read fresh from the
 * database, overwriting what the token remembers.
 *
 * The token is a week-long snapshot taken at login. Trusting it meant revoking
 * a staff member, or taking a role away, changed nothing until their token
 * expired - a week of access after they were shown the door. One small query
 * per staff action is the price of revocation that actually revokes.
 */
async function withLiveAccess(session: Session): Promise<Session> {
  if (!hasDatabase()) return session

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      kind: true,
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

  session.user.kind = user.kind
  session.user.roles = user.roles.map((r) => r.role.name)
  session.user.permissions = [
    ...new Set(user.roles.flatMap((r) => r.role.permissions.map((p) => p.permission.scope))),
  ] as Permission[]
  return session
}

export async function requireStaff(): Promise<Session> {
  const session = await withLiveAccess(await requireSession())
  if (session.user.kind !== "STAFF") {
    // 404, not 403 - a customer must not be able to probe what exists (§6).
    throw new ForbiddenError("Not found.")
  }
  return session
}

/**
 * The staff shell's gate: a live session for a current staff member, or null.
 * For the layout, which redirects rather than throwing.
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
