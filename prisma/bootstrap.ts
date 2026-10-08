/**
 * Run after `pnpm db:migrate`. Safe on a live database: only adds permissions,
 * the Admin role, the first admin (SEED_ADMIN_PASSWORD needed only to create
 * one) and missing variants at stock 0.
 */
import { PERMISSION_DEFINITIONS } from "@/lib/constants"
import { db } from "@/server/db"

import {
  databaseHost,
  ensureAdminRole,
  ensureCatalogue,
  ensureFirstAdmin,
  loadEnv,
  upsertPermissions,
} from "@/prisma/setup"

async function main() {
  loadEnv()
  if (!process.env.DATABASE_URL) {
    console.error("[BOOTSTRAP] DATABASE_URL is not set.")
    process.exit(1)
  }

  const email = process.env.SEED_ADMIN_EMAIL?.trim()
  if (!email) {
    console.error("[BOOTSTRAP] SEED_ADMIN_EMAIL is not set: whose console is this?")
    process.exit(1)
  }

  console.warn(`[BOOTSTRAP] ${databaseHost(process.env.DATABASE_URL)}: adding what is missing…`)

  await upsertPermissions(db)
  const roleId = await ensureAdminRole(db)
  const admin = await ensureFirstAdmin(db, {
    email,
    password: process.env.SEED_ADMIN_PASSWORD || undefined,
    roleId,
  })
  if (admin === "no-password") {
    console.error(
      `[BOOTSTRAP] ${email} has no console login yet. Set SEED_ADMIN_PASSWORD to a temporary password and run this again.`,
    )
    process.exit(1)
  }
  const { variantsCreated } = await ensureCatalogue(db, { stock: 0 })

  console.warn(
    `[BOOTSTRAP] done: ${PERMISSION_DEFINITIONS.length} permissions on Admin, ${email} ${admin}, ${variantsCreated} variant(s) added.`,
  )
  if (admin === "created" || admin === "promoted") {
    console.warn("[BOOTSTRAP] sign in with the temporary password; you will be asked to change it.")
  }
}

main()
  .catch((err) => {
    console.error("[BOOTSTRAP]", err)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
