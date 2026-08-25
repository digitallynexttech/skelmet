/**
 * The safe path for permission changes: never `db:seed` on a live database (§6).
 *
 * Upserts every scope in PERMISSION_DEFINITIONS and removes any that no longer
 * exist in code. Roles and their grants are left alone.
 *
 *   pnpm db:sync-permissions
 */
import { PERMISSION_DEFINITIONS } from "@/lib/constants"
import { db } from "@/server/db"

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("[SYNC-PERMISSIONS] DATABASE_URL is not set.")
    process.exit(1)
  }

  const scopes = PERMISSION_DEFINITIONS.map((p) => p.scope)

  for (const def of PERMISSION_DEFINITIONS) {
    await db.permission.upsert({
      where: { scope: def.scope },
      create: { scope: def.scope, module: def.module, label: def.label },
      update: { module: def.module, label: def.label },
    })
  }

  const removed = await db.permission.deleteMany({
    where: { scope: { notIn: scopes } },
  })

  console.warn(
    `[SYNC-PERMISSIONS] ${PERMISSION_DEFINITIONS.length} scopes in sync, ${removed.count} stale removed.`,
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
