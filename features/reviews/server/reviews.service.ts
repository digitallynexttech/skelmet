import "server-only"

import { paginate } from "@/lib/api-response"
import { PAGE_SIZE, PERMISSIONS } from "@/lib/constants"
import { hasDatabase } from "@/lib/env"
import { createAuditLog, getAuditMeta } from "@/server/audit"
import { fail, ok, runAction, type ActionResult } from "@/server/action-result"
import { requirePermission } from "@/server/action-guard"
import { db } from "@/server/db"

export type ReviewStatus = "PENDING" | "PUBLISHED" | "REJECTED"

export type ReviewRow = {
  id: string
  authorName: string
  city: string | null
  rating: number
  title: string
  body: string
  status: ReviewStatus
  createdAt: string
  product: { name: string; slug: string }
  verified: boolean
}

const REVIEW_SELECT = {
  id: true,
  authorName: true,
  city: true,
  rating: true,
  title: true,
  body: true,
  status: true,
  userId: true,
  createdAt: true,
  product: { select: { name: true, slug: true } },
} as const

type RawReview = {
  id: string
  authorName: string
  city: string | null
  rating: number
  title: string
  body: string
  status: string
  userId: string | null
  createdAt: Date
  product: { name: string; slug: string }
}

function serialize(row: RawReview): ReviewRow {
  return {
    id: row.id,
    authorName: row.authorName,
    city: row.city,
    rating: row.rating,
    title: row.title,
    body: row.body,
    status: row.status as ReviewStatus,
    createdAt: row.createdAt.toISOString(),
    product: row.product,
    // A review tied to an account is one we can trace back to an order.
    verified: row.userId !== null,
  }
}

export async function listReviews(params: {
  page?: number
  status?: string | null
}): Promise<ActionResult<{ data: ReviewRow[]; pagination: unknown; pendingCount: number }>> {
  return runAction(async () => {
    await requirePermission(PERMISSIONS.REVIEW_READ)
    if (!hasDatabase()) return fail("Database not configured.", undefined, 503)

    const page = Math.max(1, params.page ?? 1)
    const status = params.status?.trim()
    const where = status && status !== "ALL" ? { status: status as ReviewStatus } : {}

    const [rows, total, pendingCount] = await Promise.all([
      db.review.findMany({
        where,
        select: REVIEW_SELECT,
        // Oldest first: the queue is a queue, nobody should wait behind newer ones.
        orderBy: { createdAt: "asc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      db.review.count({ where }),
      db.review.count({ where: { status: "PENDING" } }),
    ])

    return ok({ ...paginate(rows.map(serialize), page, PAGE_SIZE, total), pendingCount })
  })
}

async function moderate(
  id: string,
  to: Exclude<ReviewStatus, "PENDING">,
): Promise<ActionResult<ReviewRow>> {
  return runAction(async () => {
    const session = await requirePermission(PERMISSIONS.REVIEW_MODERATE)
    if (!hasDatabase()) return fail("Database not configured.", undefined, 503)

    const before = await db.review.findUnique({ where: { id }, select: { status: true } })
    if (!before) return fail("Review not found.", undefined, 404)
    if (before.status === to)
      return fail(`That review is already ${to.toLowerCase()}.`, undefined, 409)

    const row = await db.review.update({
      where: { id },
      data: { status: to },
      select: REVIEW_SELECT,
    })

    await createAuditLog(session, {
      action: `review:${to.toLowerCase()}`,
      module: "review",
      entityId: id,
      meta: { from: before.status, to },
      ...(await getAuditMeta()),
    })

    return ok(serialize(row))
  })
}

export const publishReview = (id: string) => moderate(id, "PUBLISHED")
export const rejectReview = (id: string) => moderate(id, "REJECTED")
