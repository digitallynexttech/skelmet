import "server-only"

import type { Prisma } from "@prisma/client"
import { z } from "zod"

import { PERMISSIONS } from "@/lib/constants"
import { hasDatabase } from "@/lib/env"
import { hashPassword } from "@/lib/crypto"
import { createAuditLog, getAuditMeta } from "@/server/audit"
import { fail, ok, runAction, type ActionResult } from "@/server/action-result"
import { requirePermission } from "@/server/action-guard"
import { db } from "@/server/db"

export type StaffRow = {
  id: string
  name: string | null
  email: string
  roles: Array<{ id: string; name: string }>
  mustChangePassword: boolean
  createdAt: string
}

export type RoleRow = {
  id: string
  name: string
  description: string | null
  permissions: string[]
  staffCount: number
}

export const createStaffSchema = z.object({
  name: z.string().trim().min(2, "Enter a name").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(10, "At least 10 characters").max(200),
  roleIds: z.array(z.string().uuid()).min(1, "Pick at least one role"),
})

export const setStaffRolesSchema = z.object({
  roleIds: z.array(z.string().uuid()),
})

export const resetStaffPasswordSchema = z.object({
  password: z.string().min(10, "At least 10 characters").max(200),
})

const STAFF_SELECT = {
  id: true,
  name: true,
  email: true,
  mustChangePassword: true,
  createdAt: true,
  roles: { select: { role: { select: { id: true, name: true } } } },
} as const

function serializeStaff(row: {
  id: string
  name: string | null
  email: string
  mustChangePassword: boolean
  createdAt: Date
  roles: Array<{ role: { id: string; name: string } }>
}): StaffRow {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    mustChangePassword: row.mustChangePassword,
    createdAt: row.createdAt.toISOString(),
    roles: row.roles.map((r) => r.role),
  }
}

export async function listStaff(): Promise<ActionResult<{ staff: StaffRow[]; roles: RoleRow[] }>> {
  return runAction(async () => {
    await requirePermission(PERMISSIONS.SETTING_READ)
    if (!hasDatabase()) return fail("Database not configured.", undefined, 503)

    const [staff, roles] = await Promise.all([
      db.user.findMany({
        where: { kind: "STAFF" },
        select: STAFF_SELECT,
        orderBy: { createdAt: "asc" },
      }),
      db.role.findMany({
        select: {
          id: true,
          name: true,
          description: true,
          permissions: { select: { permission: { select: { scope: true } } } },
          _count: { select: { users: true } },
        },
        orderBy: { name: "asc" },
      }),
    ])

    return ok({
      staff: staff.map(serializeStaff),
      roles: roles.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        permissions: r.permissions.map((p) => p.permission.scope),
        staffCount: r._count.users,
      })),
    })
  })
}

/** Adds staff. An existing customer with that email is promoted in place (it has no login). */
export async function createStaff(raw: unknown): Promise<ActionResult<StaffRow>> {
  return runAction(async () => {
    const session = await requirePermission(PERMISSIONS.SETTING_WRITE)
    if (!hasDatabase()) return fail("Database not configured.", undefined, 503)

    const input = createStaffSchema.parse(raw)

    const clash = await db.user.findUnique({
      where: { email: input.email },
      select: { id: true, kind: true },
    })
    if (clash?.kind === "STAFF") return fail("Someone already has that email.", undefined, 409)

    const roles = await db.role.findMany({
      where: { id: { in: input.roleIds } },
      select: { id: true },
    })
    if (roles.length !== input.roleIds.length) return fail("Unknown role.", undefined, 422)

    const passwordHash = await hashPassword(input.password)
    // Someone else chose the password: force a change at first login.
    const login = {
      name: input.name,
      kind: "STAFF" as const,
      passwordHash,
      mustChangePassword: true,
    }

    const row = clash
      ? await db.$transaction(async (tx) => {
          // Conditional on still being a customer, so two concurrent adds cannot both succeed.
          const promoted = await tx.user.updateMany({
            where: { id: clash.id, kind: "CUSTOMER" },
            data: { ...login, sessionVersion: { increment: 1 } },
          })
          if (promoted.count === 0) return null
          await tx.userRole.deleteMany({ where: { userId: clash.id } })
          await tx.userRole.createMany({
            data: input.roleIds.map((roleId) => ({ userId: clash.id, roleId })),
            skipDuplicates: true,
          })
          return tx.user.findUniqueOrThrow({ where: { id: clash.id }, select: STAFF_SELECT })
        })
      : await db.user.create({
          data: {
            email: input.email,
            ...login,
            roles: { create: input.roleIds.map((roleId) => ({ roleId })) },
          },
          select: STAFF_SELECT,
        })
    if (!row) return fail("Someone already has that email.", undefined, 409)

    await createAuditLog(session, {
      action: "staff:create",
      module: "setting",
      entityId: row.id,
      meta: {
        email: row.email,
        roles: row.roles.map((r) => r.role.name),
        ...(clash ? { promotedFromCustomer: true } : {}),
      },
      ...(await getAuditMeta()),
    })

    return ok(serializeStaff(row))
  })
}

/** Thrown inside a staff transaction to roll it back when it would leave no administrator. */
class NoAdministratorLeft extends Error {}

const LAST_OWNER =
  "That would leave nobody who can administer the console. Give someone else an owner role first."

/**
 * Runs a role change that can never leave the console without an administrator. Every such
 * change locks the `setting:write` permission row first so they run one at a time, then counts
 * admins after the change and rolls back at zero.
 */
async function changeStaffAccess<T>(
  work: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<{ ok: true; value: T } | { ok: false }> {
  try {
    const value = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM permissions WHERE scope = ${PERMISSIONS.SETTING_WRITE} FOR UPDATE`
      const result = await work(tx)
      const admins = await tx.user.count({
        where: {
          kind: "STAFF",
          roles: {
            some: {
              role: {
                permissions: { some: { permission: { scope: PERMISSIONS.SETTING_WRITE } } },
              },
            },
          },
        },
      })
      if (admins === 0) throw new NoAdministratorLeft()
      return result
    })
    return { ok: true, value }
  } catch (err) {
    if (err instanceof NoAdministratorLeft) return { ok: false }
    throw err
  }
}

export async function setStaffRoles(id: string, raw: unknown): Promise<ActionResult<StaffRow>> {
  return runAction(async () => {
    const session = await requirePermission(PERMISSIONS.SETTING_WRITE)
    if (!hasDatabase()) return fail("Database not configured.", undefined, 503)

    const input = setStaffRolesSchema.parse(raw)

    const target = await db.user.findUnique({
      where: { id },
      select: { id: true, kind: true, email: true },
    })
    if (!target || target.kind !== "STAFF") return fail("Staff member not found.", undefined, 404)

    const changed = await changeStaffAccess(async (tx) => {
      const before = await tx.userRole.findMany({ where: { userId: id }, select: { roleId: true } })
      await tx.userRole.deleteMany({ where: { userId: id } })
      if (input.roleIds.length > 0) {
        await tx.userRole.createMany({
          data: input.roleIds.map((roleId) => ({ userId: id, roleId })),
          skipDuplicates: true,
        })
      }
      // Losing a role ends their sessions, except your own (permissions are re-read per request).
      const removed = before.some((r) => !input.roleIds.includes(r.roleId))
      if (removed && id !== session.user.id) {
        await tx.user.update({
          where: { id },
          data: { sessionVersion: { increment: 1 } },
          select: { id: true },
        })
      }
      return tx.user.findUniqueOrThrow({ where: { id }, select: STAFF_SELECT })
    })
    if (!changed.ok) return fail(LAST_OWNER, undefined, 409)
    const row = changed.value

    await createAuditLog(session, {
      action: "staff:roles",
      module: "setting",
      entityId: id,
      meta: { email: target.email, roles: row.roles.map((r) => r.role.name) },
      ...(await getAuditMeta()),
    })

    return ok(serializeStaff(row))
  })
}

/**
 * Sets a temporary password for someone else and ends their sessions. Not for your own account,
 * which must go through Change password (it asks for the current one).
 */
export async function resetStaffPassword(
  id: string,
  raw: unknown,
): Promise<ActionResult<StaffRow>> {
  return runAction(async () => {
    const session = await requirePermission(PERMISSIONS.SETTING_WRITE)
    if (!hasDatabase()) return fail("Database not configured.", undefined, 503)

    if (id === session.user.id) {
      return fail(
        "Use Change password for your own account - it asks for your current one.",
        undefined,
        409,
      )
    }

    const input = resetStaffPasswordSchema.parse(raw)
    const target = await db.user.findUnique({ where: { id }, select: { kind: true, email: true } })
    if (!target || target.kind !== "STAFF") return fail("Staff member not found.", undefined, 404)

    const row = await db.user.update({
      where: { id },
      data: {
        passwordHash: await hashPassword(input.password),
        mustChangePassword: true,
        sessionVersion: { increment: 1 },
      },
      select: STAFF_SELECT,
    })

    await createAuditLog(session, {
      action: "staff:password-reset",
      module: "setting",
      entityId: id,
      // Never the password, not even its length.
      meta: { email: target.email },
      ...(await getAuditMeta()),
    })

    return ok(serializeStaff(row))
  })
}

/**
 * Revokes access: demotes to customer, drops roles and the password, ends sessions. The row stays
 * for the audit log and orders that point at it.
 */
export async function revokeStaff(id: string): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const session = await requirePermission(PERMISSIONS.SETTING_WRITE)
    if (!hasDatabase()) return fail("Database not configured.", undefined, 503)

    if (session.user.id === id) {
      return fail("You cannot revoke your own access.", undefined, 409)
    }

    const target = await db.user.findUnique({ where: { id }, select: { kind: true, email: true } })
    if (!target || target.kind !== "STAFF") return fail("Staff member not found.", undefined, 404)

    const revoked = await changeStaffAccess(async (tx) => {
      await tx.userRole.deleteMany({ where: { userId: id } })
      await tx.user.update({
        where: { id },
        data: {
          kind: "CUSTOMER",
          passwordHash: null,
          mustChangePassword: false,
          sessionVersion: { increment: 1 },
        },
        select: { id: true },
      })
    })
    if (!revoked.ok) return fail(LAST_OWNER, undefined, 409)

    await createAuditLog(session, {
      action: "staff:revoke",
      module: "setting",
      entityId: id,
      meta: { email: target.email },
      ...(await getAuditMeta()),
    })

    return ok({ id })
  })
}
