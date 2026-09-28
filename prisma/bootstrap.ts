/**
 * Makes a fresh database administrable, and is safe on one already in use:
 * it only ever adds what is missing (prisma/setup.ts).
 *
 *   pnpm db:migrate      # the schema first
 *   pnpm db:bootstrap
 *
 * - every permission in code, and every one of them on the Admin (and any
 *   Owner) role
 * - the Admin role
 * - the first administrator, SEED_ADMIN_EMAIL with SEED_ADMIN_PASSWORD, who
 *   has to choose a new password at first sign-in. An existing member of
 *   staff at that address keeps theirs; the password is only needed when
 *   the account has to be created.
 * - the catalogue's product and variants, at stock 0 - set the real stock
 *   in the console. Existing prices and stock are never touched.
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
