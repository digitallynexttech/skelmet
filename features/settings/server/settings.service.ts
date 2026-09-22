import "server-only"

import { z } from "zod"

import { PERMISSIONS } from "@/lib/constants"
import { hasDatabase } from "@/lib/env"
import { hashPassword, referralCode } from "@/lib/crypto"
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
  password: z.string().min(10, "At least 10 characters"),
  roleIds: z.array(z.string().uuid()).min(1, "Pick at least one role"),
})

export const setStaffRolesSchema = z.object({
  roleIds: z.array(z.string().uuid()),
})

export const resetStaffPasswordSchema = z.object({
  password: z.string().min(10, "At least 10 characters"),
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

export async function createStaff(raw: unknown): Promise<ActionResult<StaffRow>> {
  return runAction(async () => {
    const session = await requirePermission(PERMISSIONS.SETTING_WRITE)
    if (!hasDatabase()) return fail("Database not configured.", undefined, 503)

    const input = createStaffSchema.parse(raw)

    const clash = await db.user.findUnique({
      where: { email: input.email },
      select: { id: true, kind: true },
    })
    if (clash) return fail("Someone already has that email.", undefined, 409)

    const roles = await db.role.findMany({
      where: { id: { in: input.roleIds } },
      select: { id: true },
    })
    if (roles.length !== input.roleIds.length) return fail("Unknown role.", undefined, 422)

    const row = await db.user.create({
      data: {
        email: input.email,
        name: input.name,
        kind: "STAFF",
        passwordHash: await hashPassword(input.password),
        // They chose nothing here, someone else did. Force a change at first login.
        mustChangePassword: true,
        referralCode: referralCode(input.name),
        roles: { create: input.roleIds.map((roleId) => ({ roleId })) },
      },
      select: STAFF_SELECT,
    })

    await createAuditLog(session, {
      action: "staff:create",
      module: "setting",
      entityId: row.id,
      meta: { email: row.email, roles: row.roles.map((r) => r.role.name) },
      ...(await getAuditMeta()),
    })

    return ok(serializeStaff(row))
  })
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

    // Never let the console end up with nobody who can administer it.
    const guard = await guardLastOwner(id, input.roleIds)
    if (guard) return guard

    const row = await db.$transaction(async (tx) => {
      await tx.userRole.deleteMany({ where: { userId: id } })
      if (input.roleIds.length > 0) {
        await tx.userRole.createMany({
          data: input.roleIds.map((roleId) => ({ userId: id, roleId })),
          skipDuplicates: true,
        })
      }
      return tx.user.findUniqueOrThrow({ where: { id }, select: STAFF_SELECT })
    })

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

export async function resetStaffPassword(
  id: string,
  raw: unknown,
): Promise<ActionResult<StaffRow>> {
  return runAction(async () => {
    const session = await requirePermission(PERMISSIONS.SETTING_WRITE)
    if (!hasDatabase()) return fail("Database not configured.", undefined, 503)

    const input = resetStaffPasswordSchema.parse(raw)
    const target = await db.user.findUnique({ where: { id }, select: { kind: true, email: true } })
    if (!target || target.kind !== "STAFF") return fail("Staff member not found.", undefined, 404)

    const row = await db.user.update({
      where: { id },
      data: { passwordHash: await hashPassword(input.password), mustChangePassword: true },
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
 * Revokes console access by demoting to a customer and dropping every role.
 * The row stays, because their audit log entries and orders point at it.
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

    const guard = await guardLastOwner(id, [])
    if (guard) return guard

    await db.$transaction(async (tx) => {
      await tx.userRole.deleteMany({ where: { userId: id } })
      await tx.user.update({ where: { id }, data: { kind: "CUSTOMER" } })
    })

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

/**
 * Refuses a change that would leave nobody holding `setting:write`. Without
 * this it is one click to lock every employee out of the console for good.
 */
async function guardLastOwner(
  userId: string,
  nextRoleIds: string[],
): Promise<ActionResult<never> | null> {
  const admins = await db.user.findMany({
    where: {
      kind: "STAFF",
      roles: {
        some: {
          role: { permissions: { some: { permission: { scope: PERMISSIONS.SETTING_WRITE } } } },
        },
      },
    },
    select: { id: true },
  })

  const isAdmin = admins.some((a) => a.id === userId)
  if (!isAdmin || admins.length > 1) return null

  // They are the only administrator. The change is fine only if it keeps them one.
  const keeps = await db.role.count({
    where: {
      id: { in: nextRoleIds },
      permissions: { some: { permission: { scope: PERMISSIONS.SETTING_WRITE } } },
    },
  })

  return keeps > 0
    ? null
    : fail(
        "That would leave nobody who can administer the console. Give someone else an owner role first.",
        undefined,
        409,
      )
}
