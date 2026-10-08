import "server-only"

import { headers } from "next/headers"
import type { Session } from "next-auth"

import { trustedClientIp } from "@/lib/rate-limit"
import { db } from "@/server/db"

/** Every mutation is audit-logged. A null actor is the system (webhook). Never throws. */
export async function createAuditLog(
  session: Session | null,
  entry: {
    action: string
    module: string
    entityId?: string
    meta?: Record<string, unknown>
    ip?: string
    userAgent?: string
  },
): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        actorId: session?.user?.id ?? null,
        action: entry.action,
        module: entry.module,
        entityId: entry.entityId ?? null,
        meta: entry.meta ? (entry.meta as object) : undefined,
        ip: entry.ip ?? null,
        userAgent: entry.userAgent ?? null,
      },
    })
  } catch (err) {
    // An audit write must never take down the mutation it is recording.
    console.error("[AUDIT]", err)
  }
}

/** Uses the trusted IP, never X-Forwarded-For, which the client sets. */
export async function getAuditMeta(): Promise<{ ip: string; userAgent: string }> {
  const h = await headers()
  return {
    ip: trustedClientIp(h) ?? "unknown",
    userAgent: h.get("user-agent")?.slice(0, 500) ?? "unknown",
  }
}
