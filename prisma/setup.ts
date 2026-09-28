/**
 * What every way of setting up a database shares - `db:bootstrap`,
 * `db:seed` and `db:sync-permissions` - written so that running any of it
 * twice, or against a database already in use, only ever adds what is
 * missing. Nothing here deletes, and nothing here overwrites an existing
 * member of staff's password.
 */
import fs from "node:fs"

import { COLOURWAYS, FLAME_SKULL_MOUNT } from "@/features/catalog/catalog"
import { PERMISSION_DEFINITIONS } from "@/lib/constants"
import { hashPassword } from "@/lib/crypto"
import type { Db } from "@/server/db"

/** These scripts run outside Next, so nothing has loaded .env yet. */
export function loadEnv(): void {
  if (!process.env.DATABASE_URL && fs.existsSync(".env")) process.loadEnvFile(".env")
}

/**
 * Whether a connection string points at this machine. The old "never in
 * production" guard read NODE_ENV, which is unset on a laptop - so the seed's
 * wipe ran happily against the hosted database from one.
 */
export function isLocalDatabase(url: string | undefined): boolean {
  if (!url) return false
  let host: string
  try {
    host = new URL(url).hostname
  } catch {
    return false
  }
  return ["localhost", "127.0.0.1", "::1", "[::1]"].includes(host)
}

export function databaseHost(url: string | undefined): string {
  try {
    return url ? new URL(url).hostname || "?" : "?"
  } catch {
    return "?"
  }
}

/** The roles that hold every permission: the one the seed makes, and an owner role if one exists. */
export const FULL_ACCESS_ROLES = ["Admin", "Owner"]

/** Upserts every scope in PERMISSION_DEFINITIONS. Never removes one. */
export async function upsertPermissions(db: Db): Promise<number> {
  for (const def of PERMISSION_DEFINITIONS) {
    await db.permission.upsert({
      where: { scope: def.scope },
      create: { scope: def.scope, module: def.module, label: def.label },
      update: { module: def.module, label: def.label },
    })
  }
  return PERMISSION_DEFINITIONS.length
}

/**
 * Gives every permission that exists to the full-access roles. Without this a
 * permission added in code reached the permissions table and no role at all,
 * so on a live database nobody - the owner included - could use the screen
 * it guarded.
 */
export async function grantAllToFullAccessRoles(db: Db): Promise<number> {
  const roles = await db.role.findMany({
    where: {
      OR: FULL_ACCESS_ROLES.map((name) => ({ name: { equals: name, mode: "insensitive" } })),
    },
    select: { id: true },
  })
  if (roles.length === 0) return 0
  const permissions = await db.permission.findMany({ select: { id: true } })
  const granted = await db.rolePermission.createMany({
    data: roles.flatMap((role) =>
      permissions.map((p) => ({ roleId: role.id, permissionId: p.id })),
    ),
    skipDuplicates: true,
  })
  return granted.count
}

/**
 * The Admin role, holding every permission.
 *
 * This is not the same thing as UserKind. `kind: STAFF` is what lets someone
 * reach the console at all, and it is checked in proxy.ts and requireStaff
 * before any permission is looked at - customers have rows in this same
 * table and must never pass that gate. The role is only about what a member
 * of staff may do once inside.
 */
export async function ensureAdminRole(db: Db): Promise<string> {
  const role = await db.role.upsert({
    where: { name: "Admin" },
    create: { name: "Admin", description: "Full access to everything" },
    update: {},
    select: { id: true },
  })
  await grantAllToFullAccessRoles(db)
  return role.id
}

/**
 * The first administrator, so a fresh database can be signed in to.
 *
 * Created with `mustChangePassword`, so the password in the environment -
 * which sits in a file on a server - only ever opens the door once. An
 * existing member of staff at that address keeps their password; they are
 * only made sure of the Admin role. A customer row at that address (someone
 * who bought before) is promoted. `resetPassword` is for the local seed's
 * reset only.
 */
export async function ensureFirstAdmin(
  db: Db,
  input: { email: string; password: string | undefined; roleId: string; resetPassword?: boolean },
): Promise<"created" | "promoted" | "kept" | "reset" | "no-password"> {
  const email = input.email.trim().toLowerCase()
  const existing = await db.user.findUnique({
    where: { email },
    select: { id: true, kind: true },
  })

  let outcome: "created" | "promoted" | "kept" | "reset"
  let userId: string

  if (existing?.kind === "STAFF" && !input.resetPassword) {
    outcome = "kept"
    userId = existing.id
  } else {
    if (!input.password) return "no-password"
    const login = {
      kind: "STAFF" as const,
      passwordHash: await hashPassword(input.password),
      mustChangePassword: true,
    }
    if (existing) {
      await db.user.update({
        where: { id: existing.id },
        data: { ...login, sessionVersion: { increment: 1 } },
        select: { id: true },
      })
      outcome = existing.kind === "STAFF" ? "reset" : "promoted"
      userId = existing.id
    } else {
      const created = await db.user.create({
        data: { email, name: "Console Admin", ...login },
        select: { id: true },
      })
      outcome = "created"
      userId = created.id
    }
  }

  await db.userRole.upsert({
    where: { userId_roleId: { userId, roleId: input.roleId } },
    create: { userId, roleId: input.roleId },
    update: {},
  })
  return outcome
}

/**
 * The catalogue's product and a variant per colourway, where missing, with
 * their media. Existing rows - their prices, their stock - are left exactly
 * as they are. New variants start at `stock`.
 */
export async function ensureCatalogue(
  db: Db,
  input: { stock: number },
): Promise<{ variantsCreated: number }> {
  const product = await db.product.upsert({
    where: { slug: FLAME_SKULL_MOUNT.slug },
    create: {
      slug: FLAME_SKULL_MOUNT.slug,
      name: FLAME_SKULL_MOUNT.name,
      strapline: FLAME_SKULL_MOUNT.strapline,
      basePrice: FLAME_SKULL_MOUNT.price,
      status: "ACTIVE",
    },
    update: {},
    select: { id: true },
  })

  let variantsCreated = 0
  for (const c of COLOURWAYS) {
    const existing = await db.variant.findUnique({ where: { sku: c.sku }, select: { id: true } })
    if (existing) continue

    const variant = await db.variant.create({
      data: {
        productId: product.id,
        colourway: c.id,
        sku: c.sku,
        price: FLAME_SKULL_MOUNT.price,
        stock: input.stock,
      },
      select: { id: true },
    })
    variantsCreated += 1

    // Media hangs off the variant, not the product: every gallery slot exists
    // in all three finishes, and a single product-level list could only ever
    // hold one of them.
    await db.mediaAsset.createMany({
      data: FLAME_SKULL_MOUNT.gallery.map((g, i) => ({
        productId: product.id,
        variantId: variant.id,
        key: g.src[c.id].replace(/^\//, ""),
        alt: `${c.name} — ${g.alt}`,
        sort: i,
      })),
    })
  }
  return { variantsCreated }
}
