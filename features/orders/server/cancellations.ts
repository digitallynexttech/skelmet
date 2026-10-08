import "server-only"

import { db } from "@/server/db"

/** Cancelled by a person, not by releaseStaleOrders. Only the audit log (order:cancel) knows. */
export async function cancelledByStaff(ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set()
  const logs = await db.auditLog.findMany({
    where: { entityId: { in: ids }, action: "order:cancel" },
    select: { entityId: true },
  })
  return new Set(logs.flatMap((l) => (l.entityId ? [l.entityId] : [])))
}
