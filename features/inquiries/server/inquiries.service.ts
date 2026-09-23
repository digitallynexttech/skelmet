import "server-only"

import { paginate } from "@/lib/api-response"
import { MAX_PAGE_SIZE, PAGE_SIZE, PERMISSIONS } from "@/lib/constants"
import { hasDatabase } from "@/lib/env"
import { createAuditLog, getAuditMeta } from "@/server/audit"
import { fail, ok, runAction, type ActionResult } from "@/server/action-result"
import { requirePermission } from "@/server/action-guard"
import { db } from "@/server/db"
import { createInquirySchema } from "@/features/inquiries/schemas/inquiry.schema"
import { z } from "zod"

export type InquiryStatus = "NEW" | "OPEN" | "RESOLVED"

export type InquiryRow = {
  id: string
  name: string
  email: string
  phone: string | null
  topic: string
  orderNumber: string | null
  message: string
  status: InquiryStatus
  createdAt: string
}

export const setInquiryStatusSchema = z.object({
  status: z.enum(["NEW", "OPEN", "RESOLVED"]),
})

const INQUIRY_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  topic: true,
  orderNumber: true,
  message: true,
  status: true,
  createdAt: true,
} as const

function serialize(row: {
  id: string
  name: string
  email: string
  phone: string | null
  topic: string
  orderNumber: string | null
  message: string
  status: string
  createdAt: Date
}): InquiryRow {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    topic: row.topic,
    orderNumber: row.orderNumber,
    message: row.message,
    status: row.status as InquiryStatus,
    createdAt: row.createdAt.toISOString(),
  }
}

export async function listInquiries(params: {
  page?: number
  pageSize?: number
  status?: string | null
  q?: string | null
}): Promise<ActionResult<{ data: InquiryRow[]; pagination: unknown; newCount: number }>> {
  return runAction(async () => {
    await requirePermission(PERMISSIONS.INQUIRY_READ)
    if (!hasDatabase()) return fail("Database not configured.", undefined, 503)

    const page = Math.max(1, params.page ?? 1)
    const size = Math.min(MAX_PAGE_SIZE, Math.max(1, params.pageSize ?? PAGE_SIZE))
    const status = params.status?.trim()
    const q = params.q?.trim()

    const where = {
      ...(status && status !== "ALL" ? { status: status as InquiryStatus } : {}),
      ...(q
        ? {
            OR: [
              { email: { contains: q, mode: "insensitive" as const } },
              { name: { contains: q, mode: "insensitive" as const } },
              { orderNumber: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    }

    const [rows, total, newCount] = await Promise.all([
      db.inquiry.findMany({
        where,
        select: INQUIRY_SELECT,
        // Oldest first, so the person who has waited longest is answered first.
        orderBy: { createdAt: "asc" },
        skip: (page - 1) * size,
        take: size,
      }),
      db.inquiry.count({ where }),
      db.inquiry.count({ where: { status: "NEW" } }),
    ])

    return ok({ ...paginate(rows.map(serialize), page, size, total), newCount })
  })
}

export async function setInquiryStatus(
  id: string,
  raw: unknown,
): Promise<ActionResult<InquiryRow>> {
  return runAction(async () => {
    const session = await requirePermission(PERMISSIONS.INQUIRY_WRITE)
    if (!hasDatabase()) return fail("Database not configured.", undefined, 503)

    const input = setInquiryStatusSchema.parse(raw)
    const before = await db.inquiry.findUnique({ where: { id }, select: { status: true } })
    if (!before) return fail("Inquiry not found.", undefined, 404)

    const row = await db.inquiry.update({
      where: { id },
      data: { status: input.status },
      select: INQUIRY_SELECT,
    })

    await createAuditLog(session, {
      action: "inquiry:status",
      module: "inquiry",
      entityId: id,
      meta: { from: before.status, to: input.status },
      ...(await getAuditMeta()),
    })

    return ok(serialize(row))
  })
}

/**
 * Public. No session, so the route rate-limits by IP and the honeypot field
 * catches the bots that fill every input they can find.
 */
export async function createInquiry(raw: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    // Read the honeypot BEFORE parsing: the schema rejects a filled one, and a
    // validation error would tell the bot exactly which check it tripped.
    // A human never sees this field, so anything in it is a bot. Answer as if
    // it worked and write nothing.
    if (typeof raw === "object" && raw !== null && "website" in raw) {
      const pot = (raw as { website?: unknown }).website
      if (typeof pot === "string" && pot.length > 0) return ok({ id: "ok" })
    }

    const input = createInquirySchema.parse(raw)

    if (!hasDatabase()) return fail("Messages are not available yet.", undefined, 503)

    const row = await db.inquiry.create({
      data: {
        name: input.name,
        email: input.email,
        phone: input.phone || null,
        topic: input.topic,
        orderNumber: input.orderNumber || null,
        message: input.message,
      },
      select: { id: true },
    })

    return ok({ id: row.id })
  })
}
