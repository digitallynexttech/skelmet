import "server-only"

import { paginate } from "@/lib/api-response"
import { PAGE_SIZE, PERMISSIONS } from "@/lib/constants"
import { hasDatabase } from "@/lib/env"
import { createAuditLog, getAuditMeta } from "@/server/audit"
import { fail, ok, runAction, type ActionResult } from "@/server/action-result"
import { requirePermission } from "@/server/action-guard"
import { db } from "@/server/db"

export type ReferralStatus = "SENT" | "OPENED" | "ORDERED" | "SHIPPING" | "PAID" | "VOID"

export type ReferralRow = {
  id: string
  refereeEmail: string
  status: ReferralStatus
  rewardAmount: string
  creditedAt: string | null
  createdAt: string
  referrer: { id: string; name: string | null; email: string; balance: string }
  orderCount: number
}

const REFERRAL_SELECT = {
  id: true,
  refereeEmail: true,
  status: true,
  rewardAmount: true,
  creditedAt: true,
  createdAt: true,
  referrer: { select: { id: true, name: true, email: true, referralBalance: true } },
  _count: { select: { orders: true } },
} as const

type RawReferral = {
  id: string
  refereeEmail: string
  status: string
  rewardAmount: { toString(): string }
  creditedAt: Date | null
  createdAt: Date
  referrer: {
    id: string
    name: string | null
    email: string
    referralBalance: { toString(): string }
  }
  _count: { orders: number }
}

function serialize(row: RawReferral): ReferralRow {
  return {
    id: row.id,
    refereeEmail: row.refereeEmail,
    status: row.status as ReferralStatus,
    rewardAmount: row.rewardAmount.toString(),
    creditedAt: row.creditedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    referrer: {
      id: row.referrer.id,
      name: row.referrer.name,
      email: row.referrer.email,
      balance: row.referrer.referralBalance.toString(),
    },
    orderCount: row._count.orders,
  }
}

export async function listReferrals(params: {
  page?: number
  status?: string | null
  q?: string | null
}): Promise<ActionResult<{ data: ReferralRow[]; pagination: unknown }>> {
  return runAction(async () => {
    await requirePermission(PERMISSIONS.REFERRAL_READ)
    if (!hasDatabase()) return fail("Database not configured.", undefined, 503)

    const page = Math.max(1, params.page ?? 1)
    const q = params.q?.trim()
    const status = params.status?.trim()

    const where = {
      ...(status && status !== "ALL" ? { status: status as ReferralStatus } : {}),
      ...(q
        ? {
            OR: [
              { refereeEmail: { contains: q, mode: "insensitive" as const } },
              { referrer: { email: { contains: q, mode: "insensitive" as const } } },
            ],
          }
        : {}),
    }

    const [rows, total] = await Promise.all([
      db.referral.findMany({
        where,
        select: REFERRAL_SELECT,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      db.referral.count({ where }),
    ])

    return ok(paginate(rows.map(serialize), page, PAGE_SIZE, total))
  })
}

/**
 * Credits the referrer and closes the referral in one transaction. The claim in
 * `where` is what stops a double payout when two people approve at once: only
 * one update can move a row out of its current status.
 */
export async function approveReferral(id: string): Promise<ActionResult<ReferralRow>> {
  return runAction(async () => {
    const session = await requirePermission(PERMISSIONS.REFERRAL_APPROVE)
    if (!hasDatabase()) return fail("Database not configured.", undefined, 503)

    const before = await db.referral.findUnique({
      where: { id },
      select: { id: true, status: true, rewardAmount: true, referrerId: true },
    })
    if (!before) return fail("Referral not found.", undefined, 404)
    if (before.status === "PAID") return fail("That referral is already paid.", undefined, 409)
    if (before.status === "VOID") return fail("That referral was voided.", undefined, 409)

    const row = await db.$transaction(async (tx) => {
      const claimed = await tx.referral.updateMany({
        where: { id, status: before.status },
        data: { status: "PAID", creditedAt: new Date() },
      })
      if (claimed.count === 0) {
        throw new Error("That referral was just changed by someone else. Reload and try again.")
      }

      await tx.user.update({
        where: { id: before.referrerId },
        data: { referralBalance: { increment: before.rewardAmount } },
      })

      return tx.referral.findUniqueOrThrow({ where: { id }, select: REFERRAL_SELECT })
    })

    await createAuditLog(session, {
      action: "referral:approve",
      module: "referral",
      entityId: id,
      meta: { from: before.status, reward: before.rewardAmount.toString() },
      ...(await getAuditMeta()),
    })

    return ok(serialize(row))
  })
}

export async function voidReferral(id: string): Promise<ActionResult<ReferralRow>> {
  return runAction(async () => {
    const session = await requirePermission(PERMISSIONS.REFERRAL_APPROVE)
    if (!hasDatabase()) return fail("Database not configured.", undefined, 503)

    const before = await db.referral.findUnique({ where: { id }, select: { status: true } })
    if (!before) return fail("Referral not found.", undefined, 404)
    if (before.status === "PAID") {
      return fail("That referral is already paid, it cannot be voided.", undefined, 409)
    }

    const claimed = await db.referral.updateMany({
      where: { id, status: before.status },
      data: { status: "VOID" },
    })
    if (claimed.count === 0) {
      return fail("That referral was just changed by someone else.", undefined, 409)
    }

    const row = await db.referral.findUniqueOrThrow({ where: { id }, select: REFERRAL_SELECT })

    await createAuditLog(session, {
      action: "referral:void",
      module: "referral",
      entityId: id,
      meta: { from: before.status },
      ...(await getAuditMeta()),
    })

    return ok(serialize(row))
  })
}
