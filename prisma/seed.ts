/**
 * DESTRUCTIVE: never run this against a live database (§6).
 * For permission changes on a live database use `pnpm db:sync-permissions`.
 *
 *   pnpm db:seed
 */
import fs from "node:fs"

import { COLOURWAYS, FLAME_SKULL_MOUNT } from "@/features/catalog/catalog"
import { PERMISSION_DEFINITIONS } from "@/lib/constants"
import { hashPassword } from "@/lib/crypto"
import { db } from "@/server/db"

async function main() {
  // Runs outside Next, so nothing has loaded .env yet.
  if (!process.env.DATABASE_URL && fs.existsSync(".env")) process.loadEnvFile(".env")

  if (!process.env.DATABASE_URL) {
    console.error("[SEED] DATABASE_URL is not set.")
    process.exit(1)
  }

  if (process.env.NODE_ENV === "production" && !process.env.SEED_I_KNOW_WHAT_I_AM_DOING) {
    console.error(
      "[SEED] Refusing to run in production. Set SEED_I_KNOW_WHAT_I_AM_DOING=1 only on a throwaway database.",
    )
    process.exit(1)
  }

  console.warn("[SEED] wiping catalogue, roles and permissions…")

  await db.orderItem.deleteMany()
  await db.cartItem.deleteMany()
  await db.mediaAsset.deleteMany()
  await db.variant.deleteMany()
  await db.product.deleteMany()
  await db.rolePermission.deleteMany()
  await db.permission.deleteMany()

  // ── permissions ────────────────────────────────────────────
  for (const def of PERMISSION_DEFINITIONS) {
    await db.permission.create({
      data: { scope: def.scope, module: def.module, label: def.label },
    })
  }

  // ── role ───────────────────────────────────────────────────
  // One role, holding every permission.
  //
  // This is not the same thing as UserKind. `kind: STAFF` is what lets
  // someone reach the console at all, and it is checked in proxy.ts and
  // requireStaff before any permission is looked at - customers have rows
  // in this same table and must never pass that gate. The role is only
  // about what a member of staff may do once inside.
  //
  // The grant is derived from the permissions table rather than listed, so
  // a permission added later is held by Admin the moment it exists and
  // cannot be forgotten here.
  const adminRole = await db.role.upsert({
    where: { name: "Admin" },
    create: { name: "Admin", description: "Full access to everything" },
    update: { description: "Full access to everything" },
  })

  const allPermissions = await db.permission.findMany({ select: { id: true } })
  await db.rolePermission.createMany({
    data: allPermissions.map((x) => ({ roleId: adminRole.id, permissionId: x.id })),
    skipDuplicates: true,
  })

  // ── catalogue ──────────────────────────────────────────────
  const product = await db.product.create({
    data: {
      slug: FLAME_SKULL_MOUNT.slug,
      name: FLAME_SKULL_MOUNT.name,
      strapline: FLAME_SKULL_MOUNT.strapline,
      basePrice: FLAME_SKULL_MOUNT.price,
      status: "ACTIVE",
    },
    select: { id: true },
  })

  for (const c of COLOURWAYS) {
    const variant = await db.variant.create({
      data: {
        productId: product.id,
        colourway: c.id,
        sku: c.sku,
        price: FLAME_SKULL_MOUNT.price,
        stock: 25,
      },
      select: { id: true },
    })

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

  // ── staff login ────────────────────────────────────────────
  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@skelmet.in"
  const password = process.env.SEED_ADMIN_PASSWORD ?? "skelmet-dev"

  const admin = await db.user.upsert({
    where: { email },
    create: {
      email,
      name: "Console Admin",
      kind: "STAFF",
      passwordHash: await hashPassword(password),
    },
    update: { kind: "STAFF", passwordHash: await hashPassword(password) },
    select: { id: true },
  })

  await db.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: adminRole.id } },
    create: { userId: admin.id, roleId: adminRole.id },
    update: {},
  })

  console.warn(
    `[SEED] done: ${PERMISSION_DEFINITIONS.length} permissions, 2 roles, 1 product, ${COLOURWAYS.length} variants.`,
  )
  console.warn(`[SEED] console login: ${email} / ${password}`)
  console.warn("[SEED] change that password before anything is public.")
}

main()
  .catch((err) => {
    console.error("[SEED]", err)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
