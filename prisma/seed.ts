/**
 * Development seed. Only adds what is missing; SEED_RESET=1 wipes the catalogue,
 * roles and permissions, and only on localhost unless
 * SEED_I_KNOW_WHAT_I_AM_DOING=1 (never a live database). The admin password
 * defaults to "skelmet-dev" on localhost only.
 */
import { PERMISSION_DEFINITIONS } from "@/lib/constants"
import { db } from "@/server/db"

import {
  databaseHost,
  ensureAdminRole,
  ensureCatalogue,
  ensureFirstAdmin,
  isLocalDatabase,
  loadEnv,
  upsertPermissions,
} from "@/prisma/setup"

async function main() {
  loadEnv()
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error("[SEED] DATABASE_URL is not set.")
    process.exit(1)
  }

  const local = isLocalDatabase(url)
  const reset = process.env.SEED_RESET === "1"
  const override = process.env.SEED_I_KNOW_WHAT_I_AM_DOING === "1"

  if (reset && !local && !override) {
    console.error(
      `[SEED] Refusing to reset ${databaseHost(url)}: it is not a database on this machine. Set SEED_I_KNOW_WHAT_I_AM_DOING=1 only for a throwaway one.`,
    )
    process.exit(1)
  }

  const password = process.env.SEED_ADMIN_PASSWORD || (local ? "skelmet-dev" : undefined)
  if (!password) {
    console.error(
      `[SEED] SEED_ADMIN_PASSWORD is required for ${databaseHost(url)}: the "skelmet-dev" default is for a local database only.`,
    )
    process.exit(1)
  }

  if (reset) {
    console.warn(
      `[SEED] SEED_RESET=1: wiping the catalogue, roles and permissions on ${databaseHost(url)}…`,
    )
    await db.orderItem.deleteMany()
    await db.cartItem.deleteMany()
    await db.mediaAsset.deleteMany()
    await db.variant.deleteMany()
    // Cascades to the reviews.
    await db.product.deleteMany()
    await db.rolePermission.deleteMany()
    await db.permission.deleteMany()
  }

  await upsertPermissions(db)
  const roleId = await ensureAdminRole(db)
  const { variantsCreated } = await ensureCatalogue(db, { stock: 25 })

  const email = process.env.SEED_ADMIN_EMAIL?.trim() || "admin@skelmet.in"
  const admin = await ensureFirstAdmin(db, { email, password, roleId, resetPassword: reset })

  console.warn(
    `[SEED] done: ${PERMISSION_DEFINITIONS.length} permissions, ${variantsCreated} variant(s) added, console login ${email} (${admin}).`,
  )
  if (admin !== "kept") {
    console.warn("[SEED] sign in with SEED_ADMIN_PASSWORD; you will be asked to change it.")
  }
}

main()
  .catch((err) => {
    console.error("[SEED]", err)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
