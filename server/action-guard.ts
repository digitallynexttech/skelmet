import "server-only"

import type { Session } from "next-auth"

import type { Permission } from "@/lib/constants"
import { ForbiddenError, UnauthorizedError } from "@/lib/errors"
import { auth } from "@/server/auth"

/**
 * Guards live inside the service, not the route (§5). Hiding a nav item is
 * cosmetic; these and proxy.ts are the enforcement.
 */

export async function requireSession(): Promise<Session> {
  const session = await auth()
  if (!session?.user?.id) throw new UnauthorizedError()
  return session
}

export async function requireStaff(): Promise<Session> {
  const session = await requireSession()
  if (session.user.kind !== "STAFF") {
    // 404, not 403 — a customer must not be able to probe what exists (§6).
    throw new ForbiddenError("Not found.")
  }
  return session
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
