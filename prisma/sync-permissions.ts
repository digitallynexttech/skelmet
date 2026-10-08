/**
 * Permission changes on a live database (never `db:seed` there). Removes scopes
 * gone from code and grants all to full-access roles; other roles are a
 * person's decision.
 */
import { PERMISSION_DEFINITIONS } from "@/lib/constants"
import { db } from "@/server/db"

import { grantAllToFullAccessRoles, loadEnv, upsertPermissions } from "@/prisma/setup"

async function main() {
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
