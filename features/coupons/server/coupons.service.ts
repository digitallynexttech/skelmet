import "server-only"

import { couponReduction } from "@/features/cart/server/cart-pricing"
import {
  createCouponSchema,
  PERCENT_TOO_HIGH,
  percentTooHigh,
  updateCouponSchema,
  validateCouponSchema,
} from "@/features/coupons/schemas/coupon.schema"
import {
  COUPON_UNUSABLE,
  couponIsLive,
  minimumSpendMessage,
} from "@/features/coupons/server/coupon-rules"
import { paginate } from "@/lib/api-response"
import { MAX_PAGE_SIZE, PAGE_SIZE, PERMISSIONS } from "@/lib/constants"
import { hasDatabase } from "@/lib/env"
import { createAuditLog, getAuditMeta } from "@/server/audit"
import { fail, ok, runAction, type ActionResult } from "@/server/action-result"
import { requirePermission } from "@/server/action-guard"
import { db } from "@/server/db"

const COUPON_SELECT = {
  id: true,
  code: true,
  kind: true,
  value: true,
  minSubtotal: true,
  maxUses: true,
  usedCount: true,
  expiresAt: true,
  createdAt: true,
} as const

export type CouponRow = {
  id: string
  code: string
  kind: "PERCENT" | "FLAT"
  value: string
  minSubtotal: string
  maxUses: number | null
  usedCount: number
  expiresAt: string | null
  createdAt: string
  state: "ACTIVE" | "EXPIRED" | "EXHAUSTED"
}

function serialize(row: {
  id: string
  code: string
  kind: string
  value: { toString(): string }
  minSubtotal: { toString(): string }
  maxUses: number | null
  usedCount: number
  expiresAt: Date | null
  createdAt: Date
}): CouponRow {
  const expired = row.expiresAt !== null && row.expiresAt.getTime() < Date.now()
  const exhausted = row.maxUses !== null && row.usedCount >= row.maxUses
  return {
    id: row.id,
    code: row.code,
    kind: row.kind as "PERCENT" | "FLAT",
    value: row.value.toString(),
    minSubtotal: row.minSubtotal.toString(),
    maxUses: row.maxUses,
    usedCount: row.usedCount,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    state: expired ? "EXPIRED" : exhausted ? "EXHAUSTED" : "ACTIVE",
  }
}

export async function listCoupons(params: {
  page?: number
  pageSize?: number
  q?: string | null
}): Promise<ActionResult<{ data: CouponRow[]; pagination: unknown }>> {
  return runAction(async () => {
    await requirePermission(PERMISSIONS.COUPON_READ)
    if (!hasDatabase()) return fail("Database not configured.", undefined, 503)

    const page = Math.max(1, params.page ?? 1)
    const size = Math.min(MAX_PAGE_SIZE, Math.max(1, params.pageSize ?? PAGE_SIZE))
    const q = params.q?.trim()
    const where = q ? { code: { contains: q.toUpperCase() } } : {}

    const [rows, total] = await Promise.all([
      db.coupon.findMany({
        where,
        select: COUPON_SELECT,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * size,
        take: size,
      }),
      db.coupon.count({ where }),
    ])

    return ok(paginate(rows.map(serialize), page, size, total))
  })
}

export async function createCoupon(raw: unknown): Promise<ActionResult<CouponRow>> {
  return runAction(async () => {
    const session = await requirePermission(PERMISSIONS.COUPON_WRITE)
    if (!hasDatabase()) return fail("Database not configured.", undefined, 503)

    const input = createCouponSchema.parse(raw)

    const clash = await db.coupon.findUnique({ where: { code: input.code }, select: { id: true } })
    if (clash) return fail("A coupon with that code already exists.", undefined, 409)

    const row = await db.coupon.create({
      data: {
        code: input.code,
        kind: input.kind,
        value: input.value,
        minSubtotal: input.minSubtotal,
        maxUses: input.maxUses ?? null,
        expiresAt: input.expiresAt ?? null,
      },
      select: COUPON_SELECT,
    })

    await createAuditLog(session, {
      action: "coupon:create",
      module: "coupon",
      entityId: row.id,
      meta: { code: row.code, kind: row.kind, value: row.value.toString() },
      ...(await getAuditMeta()),
    })

    return ok(serialize(row))
  })
}

export async function updateCoupon(id: string, raw: unknown): Promise<ActionResult<CouponRow>> {
  return runAction(async () => {
    const session = await requirePermission(PERMISSIONS.COUPON_WRITE)
    if (!hasDatabase()) return fail("Database not configured.", undefined, 503)

    const input = updateCouponSchema.parse(raw)
    const exists = await db.coupon.findUnique({
      where: { id },
      select: { id: true, kind: true, value: true },
    })
    if (!exists) return fail("Coupon not found.", undefined, 404)

    // The 90% rule for the coupon as it will be after this edit, not only for
    // the half of it the edit happens to send.
    if (percentTooHigh(input.kind ?? exists.kind, input.value ?? Number(exists.value))) {
      return fail(PERCENT_TOO_HIGH, { fieldErrors: { value: [PERCENT_TOO_HIGH] } }, 422)
    }

    const row = await db.coupon.update({
      where: { id },
      data: {
        ...(input.kind ? { kind: input.kind } : {}),
        ...(input.value !== undefined ? { value: input.value } : {}),
        ...(input.minSubtotal !== undefined ? { minSubtotal: input.minSubtotal } : {}),
        ...(input.maxUses !== undefined ? { maxUses: input.maxUses } : {}),
        ...(input.expiresAt !== undefined ? { expiresAt: input.expiresAt } : {}),
      },
      select: COUPON_SELECT,
    })

    await createAuditLog(session, {
      action: "coupon:update",
      module: "coupon",
      entityId: id,
      meta: input as Record<string, unknown>,
      ...(await getAuditMeta()),
    })

    return ok(serialize(row))
  })
}

/** Expire rather than delete, so historic orders keep their coupon reference. */
export async function expireCoupon(id: string): Promise<ActionResult<CouponRow>> {
  return runAction(async () => {
    const session = await requirePermission(PERMISSIONS.COUPON_WRITE)
    if (!hasDatabase()) return fail("Database not configured.", undefined, 503)

    const exists = await db.coupon.findUnique({ where: { id }, select: { id: true } })
    if (!exists) return fail("Coupon not found.", undefined, 404)

    const row = await db.coupon.update({
      where: { id },
      data: { expiresAt: new Date() },
      select: COUPON_SELECT,
    })

    await createAuditLog(session, {
      action: "coupon:expire",
      module: "coupon",
      entityId: id,
      ...(await getAuditMeta()),
    })

    return ok(serialize(row))
  })
}

/** Public, called from the cart. Rate-limited at the route. */
export async function validateCoupon(
  raw: unknown,
): Promise<ActionResult<{ code: string; discount: number; label: string }>> {
  return runAction(async () => {
    const input = validateCouponSchema.parse(raw)
    if (!hasDatabase()) return fail("Discount codes are not available yet.", undefined, 503)

    const coupon = await db.coupon.findUnique({
      where: { code: input.code },
      select: {
        code: true,
        kind: true,
        value: true,
        minSubtotal: true,
        maxUses: true,
        usedCount: true,
        expiresAt: true,
      },
    })

    // Missing, expired and used up all read the same, so this cannot be used
    // to find out which codes exist (coupon-rules.ts).
    if (!coupon || !couponIsLive(coupon)) return fail(COUPON_UNUSABLE, undefined, 422)

    const discount = couponReduction(coupon, input.subtotal)
    if (discount <= 0) return fail(minimumSpendMessage(coupon.minSubtotal), undefined, 422)

    return ok({
      code: coupon.code,
      discount,
      label:
        coupon.kind === "PERCENT" ? `${Number(coupon.value)}% off` : `₹${Number(coupon.value)} off`,
    })
  })
}
