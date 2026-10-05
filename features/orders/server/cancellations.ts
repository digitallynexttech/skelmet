import "server-only"

import { db } from "@/server/db"

/**
 * Which of these cancelled orders a person called off. The rest were never
 * paid for and were cancelled automatically to put their stock back on sale
 * (releaseStaleOrders). The order itself does not say which; only the audit
 * log does, where every cancel from the console is written as order:cancel.
 */
export async function cancelledByStaff(ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set()
  const logs = await db.auditLog.findMany({
    where: { entityId: { in: ids }, action: "order:cancel" },
    select: { entityId: true },
  })
  return new Set(logs.flatMap((l) => (l.entityId ? [l.entityId] : [])))
}
