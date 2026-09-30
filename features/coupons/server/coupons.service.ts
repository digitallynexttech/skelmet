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
  archivedAt: true,
  showInCart: true,
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
  archivedAt: string | null
  showInCart: boolean
  createdAt: string
  state: "ACTIVE" | "EXPIRED" | "EXHAUSTED"
}

/** A code as the cart offers it: what it takes off, and from what spend. */
export type CartOffer = {
  code: string
  label: string
  minSubtotal: string
  expiresAt: string | null
}

const offerLabel = (c: { kind: string; value: { toString(): string } }) =>
  c.kind === "PERCENT" ? `${Number(c.value)}% off` : `₹${Number(c.value)} off`

function serialize(row: {
  id: string
  code: string
  kind: string
  value: { toString(): string }
  minSubtotal: { toString(): string }
  maxUses: number | null
  usedCount: number
  expiresAt: Date | null
  archivedAt: Date | null
  showInCart: boolean
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
    archivedAt: row.archivedAt?.toISOString() ?? null,
    showInCart: row.showInCart,
    createdAt: row.createdAt.toISOString(),
    state: expired ? "EXPIRED" : exhausted ? "EXHAUSTED" : "ACTIVE",
  }
}

/** Live codes first, then used up, then expired; newest first within each. */
const STATE_ORDER: Record<CouponRow["state"], number> = { ACTIVE: 0, EXHAUSTED: 1, EXPIRED: 2 }

export async function listCoupons(params: {
  page?: number
  pageSize?: number
  q?: string | null
  view?: string | null
}): Promise<ActionResult<{ data: CouponRow[]; pagination: unknown }>> {
  return runAction(async () => {
    await requirePermission(PERMISSIONS.COUPON_READ)
    if (!hasDatabase()) return fail("Database not configured.", undefined, 503)

    const page = Math.max(1, params.page ?? 1)
    const size = Math.min(MAX_PAGE_SIZE, Math.max(1, params.pageSize ?? PAGE_SIZE))
    const q = params.q?.trim()
    const archived = params.view === "archived"
    const where = {
      archivedAt: archived ? { not: null } : null,
      ...(q ? { code: { contains: q.toUpperCase() } } : {}),
    }

    // The state is worked out from the row, so the order is too: every code
    // is read (a shop has tens, not thousands) and sorted here, then paged.
    const rows = (
      await db.coupon.findMany({ where, select: COUPON_SELECT, orderBy: { createdAt: "desc" } })
    ).map(serialize)
    if (!archived) rows.sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state])

    return ok(paginate(rows.slice((page - 1) * size, page * size), page, size, rows.length))
  })
}

/**
 * The codes the cart offers: switched on for it, not archived, and still
 * usable. Public - the cart asks when it opens - and only ever codes staff
 * chose to show, so it tells nobody anything they were not meant to see.
 */
export async function listCartOffers(): Promise<ActionResult<CartOffer[]>> {
  return runAction(async () => {
    if (!hasDatabase()) return ok([])
    const rows = await db.coupon.findMany({
      where: { showInCart: true, archivedAt: null },
      select: {
        code: true,
        kind: true,
        value: true,
        minSubtotal: true,
        maxUses: true,
        usedCount: true,
        expiresAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    })
    return ok(
      rows
        .filter((c) => couponIsLive(c))
        .map((c) => ({
          code: c.code,
          label: offerLabel(c),
          minSubtotal: c.minSubtotal.toString(),
          expiresAt: c.expiresAt?.toISOString() ?? null,
        })),
    )
  })
}

/**
 * Archive or restore. Archived, a code leaves the list for the Archive tab,
 * stops being offered in the cart and is no longer accepted anywhere;
 * restored, it is exactly what it was.
 */
export async function setCouponArchived(
  id: string,
  archived: boolean,
): Promise<ActionResult<CouponRow>> {
  return runAction(async () => {
    const session = await requirePermission(PERMISSIONS.COUPON_WRITE)
    if (!hasDatabase()) return fail("Database not configured.", undefined, 503)

    const exists = await db.coupon.findUnique({ where: { id }, select: { id: true } })
    if (!exists) return fail("Coupon not found.", undefined, 404)

    const row = await db.coupon.update({
      where: { id },
      data: { archivedAt: archived ? new Date() : null },
      select: COUPON_SELECT,
    })

    await createAuditLog(session, {
      action: archived ? "coupon:archive" : "coupon:restore",
      module: "coupon",
      entityId: id,
      meta: { code: row.code },
      ...(await getAuditMeta()),
    })

    return ok(serialize(row))
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
        showInCart: input.showInCart,
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
        ...(input.showInCart !== undefined ? { showInCart: input.showInCart } : {}),
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
        archivedAt: true,
      },
    })

    // Missing, archived, expired and used up all read the same, so this cannot be used
    // to find out which codes exist (coupon-rules.ts).
    if (!coupon || !couponIsLive(coupon)) return fail(COUPON_UNUSABLE, undefined, 422)

    const discount = couponReduction(coupon, input.subtotal)
    if (discount <= 0) return fail(minimumSpendMessage(coupon.minSubtotal), undefined, 422)

    return ok({ code: coupon.code, discount, label: offerLabel(coupon) })
  })
}
