/**
 * Shared by db:bootstrap, db:seed and db:sync-permissions. Idempotent: only adds,
 * never deletes or overwrites a staff password.
 */
import fs from "node:fs"

import { FLAME_SKULL_MOUNT, PRODUCTS } from "@/features/catalog/catalog"
import { FULL_ACCESS_ROLES, PERMISSION_DEFINITIONS } from "@/lib/constants"
import { hashPassword } from "@/lib/crypto"
import type { Db } from "@/server/db"

/** These scripts run outside Next, so nothing has loaded .env yet. */
export function loadEnv(): void {
  if (!process.env.DATABASE_URL && fs.existsSync(".env")) process.loadEnvFile(".env")
}

/** By host, not NODE_ENV, which is unset on a laptop pointed at the live database. */
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

export { FULL_ACCESS_ROLES }

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

/** Without this, a permission added in code reaches no role and nobody can use its screen. */
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
 * Roles are not the console gate: `kind: STAFF` is (proxy.ts, requireStaff), and
 * customers share the users table. A role only limits staff once inside.
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
 * Created with `mustChangePassword`, so the env password works once. Existing
 * staff keep their password; a customer at that address is promoted.
 * `resetPassword` is for the local seed's reset only.
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
 * Adds missing products and variants with media; existing rows are untouched.
 * A new product other than the Flame Skull starts as DRAFT.
 */
export async function ensureCatalogue(
  db: Db,
  input: { stock: number },
): Promise<{ variantsCreated: number }> {
  let variantsCreated = 0
  for (const item of PRODUCTS) {
    const product = await db.product.upsert({
      where: { slug: item.slug },
      create: {
        slug: item.slug,
        name: item.name,
        strapline: item.strapline,
        basePrice: item.price,
        status: item.slug === FLAME_SKULL_MOUNT.slug ? "ACTIVE" : "DRAFT",
      },
      update: {},
      select: { id: true },
    })

    for (const c of item.colourways) {
      const existing = await db.variant.findUnique({ where: { sku: c.sku }, select: { id: true } })
      if (existing) continue

      const variant = await db.variant.create({
        data: {
          productId: product.id,
          colourway: c.id,
          sku: c.sku,
          price: item.price,
          stock: input.stock,
        },
        select: { id: true },
      })
      variantsCreated += 1

      // Media hangs off the variant: each finish has its own gallery.
      await db.mediaAsset.createMany({
        data: item.gallery[c.id].map((g, i) => ({
          productId: product.id,
          variantId: variant.id,
          key: g.src.replace(/^\//, ""),
          alt: `${c.name} — ${g.alt}`,
          sort: i,
        })),
      })
    }
  }
  return { variantsCreated }
}
