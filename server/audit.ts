import "server-only"

import { headers } from "next/headers"
import type { Session } from "next-auth"

import { db } from "@/server/db"

/** Every mutation is audit-logged (§9). A null actor is the system (cron/webhook). */
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

export async function getAuditMeta(): Promise<{ ip: string; userAgent: string }> {
  const h = await headers()
  const forwarded = h.get("x-forwarded-for")
  return {
    ip: forwarded?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "unknown",
    userAgent: h.get("user-agent") ?? "unknown",
  }
}
