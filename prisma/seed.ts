/**
 * DESTRUCTIVE: never run this against a live database (§6).
 * For permission changes on a live database use `pnpm db:sync-permissions`.
 *
 *   pnpm db:seed
 */
import fs from "node:fs"

import { COLOURWAYS, FLAME_SKULL_MOUNT } from "@/features/catalog/catalog"
import { PERMISSION_DEFINITIONS } from "@/lib/constants"
import { hashPassword, referralCode } from "@/lib/crypto"
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

  // ── roles ──────────────────────────────────────────────────
  const owner = await db.role.upsert({
    where: { name: "Owner" },
    create: { name: "Owner", description: "Full access to everything" },
    update: {},
  })

  const allPermissions = await db.permission.findMany({ select: { id: true } })
  await db.rolePermission.createMany({
    data: allPermissions.map((p) => ({ roleId: owner.id, permissionId: p.id })),
    skipDuplicates: true,
  })

  await db.role.upsert({
    where: { name: "Support" },
    create: { name: "Support", description: "Orders and inquiries, no settings" },
    update: {},
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
    await db.variant.create({
      data: {
        productId: product.id,
        colourway: c.id,
        sku: c.sku,
        price: FLAME_SKULL_MOUNT.price,
        stock: 25,
      },
    })
  }

  await db.mediaAsset.createMany({
    data: FLAME_SKULL_MOUNT.gallery.map((g, i) => ({
      productId: product.id,
      key: g.src.replace(/^\//, ""),
      alt: g.alt,
      sort: i,
    })),
  })

  // ── staff login ────────────────────────────────────────────
  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@skelmet.in"
  const password = process.env.SEED_ADMIN_PASSWORD ?? "skelmet-dev"

  const admin = await db.user.upsert({
    where: { email },
    create: {
      email,
      name: "Console Owner",
      kind: "STAFF",
      passwordHash: await hashPassword(password),
      referralCode: referralCode("Owner"),
    },
    update: { kind: "STAFF", passwordHash: await hashPassword(password) },
    select: { id: true },
  })

  await db.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: owner.id } },
    create: { userId: admin.id, roleId: owner.id },
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
