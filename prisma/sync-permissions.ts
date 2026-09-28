/**
 * The safe path for permission changes: never `db:seed` on a live database (§6).
 *
 * Upserts every scope in PERMISSION_DEFINITIONS, removes any that no longer
 * exist in code, and gives every permission to the full-access roles (Admin,
 * and Owner if there is one) - a scope added in code used to reach the
 * permissions table and no role at all, so nobody could use what it guarded.
 * Other roles are left alone: what they may do is a person's decision.
 *
 *   pnpm db:sync-permissions
 */
import { PERMISSION_DEFINITIONS } from "@/lib/constants"
import { db } from "@/server/db"

import { grantAllToFullAccessRoles, loadEnv, upsertPermissions } from "@/prisma/setup"

async function main() {
  // Runs outside Next, so nothing has loaded .env yet.
  loadEnv()
  if (!process.env.DATABASE_URL) {
    console.error("[SYNC-PERMISSIONS] DATABASE_URL is not set.")
    process.exit(1)
  }

  const scopes = PERMISSION_DEFINITIONS.map((p) => p.scope)
  await upsertPermissions(db)

  const removed = await db.permission.deleteMany({
    where: { scope: { notIn: scopes } },
  })
  const granted = await grantAllToFullAccessRoles(db)

  console.warn(
    `[SYNC-PERMISSIONS] ${PERMISSION_DEFINITIONS.length} scopes in sync, ${removed.count} stale removed, ${granted} new grant(s) to the full-access roles.`,
  )
}

main()
  .catch((err) => {
    console.error("[SYNC-PERMISSIONS]", err)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
