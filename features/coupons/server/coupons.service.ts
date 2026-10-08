import "server-only"

import { couponReduction } from "@/features/cart/server/cart-pricing"
import {
  splitRuns,
  type CouponEvent,
  type CouponRun,
  type HistoryOrder,
} from "@/features/coupons/coupon-history"
import {
  createCouponSchema,
  PERCENT_TOO_HIGH,
  percentTooHigh,
  renewCouponSchema,
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
import { can, requirePermission } from "@/server/action-guard"
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

    // State is derived, so all codes (tens, not thousands) are sorted here, then paged.
    const rows = (
      await db.coupon.findMany({ where, select: COUPON_SELECT, orderBy: { createdAt: "desc" } })
    ).map(serialize)
    if (!archived) rows.sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state])

    return ok(paginate(rows.slice((page - 1) * size, page * size), page, size, rows.length))
  })
}

/** Public: only live, unarchived codes staff switched on for the cart. */
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

/** An archived code is accepted nowhere; restoring brings it back unchanged. */
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

    // Codes are unique for good (past orders point at them); a finished one is renewed instead.
    const clash = await db.coupon.findUnique({ where: { code: input.code }, select: COUPON_SELECT })
    if (clash) {
      const existing = serialize(clash)
      const live = existing.state === "ACTIVE" && !existing.archivedAt
      return fail(
        live
          ? `${existing.code} already exists and is live. Edit or expire it instead.`
          : `${existing.code} was used before (${existing.archivedAt ? "archived" : existing.state.toLowerCase()}). Renew it to run it again with these settings.`,
        { existing: { id: existing.id, code: existing.code, renewable: !live } },
        409,
      )
    }

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
      meta: {
        code: row.code,
        kind: row.kind,
        value: row.value.toString(),
        minSubtotal: row.minSubtotal.toString(),
        maxUses: row.maxUses,
        expiresAt: row.expiresAt?.toISOString() ?? null,
      },
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

    // The 90% rule on the coupon as edited, not only the fields sent.
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

/**
 * Runs an old code again with new terms. The row stays, so past orders still
 * point at it; uses restart at 0 and it leaves the archive.
 */
export async function renewCoupon(id: string, raw: unknown): Promise<ActionResult<CouponRow>> {
  return runAction(async () => {
    const session = await requirePermission(PERMISSIONS.COUPON_WRITE)
    if (!hasDatabase()) return fail("Database not configured.", undefined, 503)

    const input = renewCouponSchema.parse(raw)
    const before = await db.coupon.findUnique({
      where: { id },
      select: { id: true, usedCount: true, expiresAt: true, archivedAt: true },
    })
    if (!before) return fail("Coupon not found.", undefined, 404)

    const row = await db.coupon.update({
      where: { id },
      data: {
        kind: input.kind,
        value: input.value,
        minSubtotal: input.minSubtotal,
        maxUses: input.maxUses ?? null,
        expiresAt: input.expiresAt ?? null,
        showInCart: input.showInCart,
        usedCount: 0,
        archivedAt: null,
      },
      select: COUPON_SELECT,
    })

    await createAuditLog(session, {
      action: "coupon:renew",
      module: "coupon",
      entityId: id,
      meta: {
        code: row.code,
        previousUses: before.usedCount,
        previousExpiry: before.expiresAt?.toISOString() ?? null,
        wasArchived: before.archivedAt !== null,
        // The new run's terms, read by the code's history.
        kind: row.kind,
        value: row.value.toString(),
        minSubtotal: row.minSubtotal.toString(),
        maxUses: row.maxUses,
        expiresAt: row.expiresAt?.toISOString() ?? null,
      },
      ...(await getAuditMeta()),
    })

    return ok(serialize(row))
  })
}

export type CouponHistory = {
  coupon: CouponRow
  runs: CouponRun[]
  /** Every order placed with the code, newest first; empty without order access. */
  orders: (HistoryOrder & { run: number })[]
  /** Whether the viewer may see the orders themselves, not only their totals. */
  canSeeOrders: boolean
  events: CouponEvent[]
}

/** One code's runs, orders and audit events (features/coupons/coupon-history). */
export async function getCouponHistory(
  key: { id: string } | { code: string },
): Promise<ActionResult<CouponHistory>> {
  return runAction(async () => {
    const session = await requirePermission(PERMISSIONS.COUPON_READ)
    if (!hasDatabase()) return fail("Database not configured.", undefined, 503)

    // From the URL (/admin/coupons/DIWALI200), in any case.
    const where = "code" in key ? { code: key.code.trim().toUpperCase() } : { id: key.id }
    const row = await db.coupon.findUnique({ where, select: COUPON_SELECT })
    if (!row) return fail("No code by that name.", undefined, 404)
    const coupon = serialize(row)
    const id = row.id

    const [logs, placed] = await Promise.all([
      db.auditLog.findMany({
        where: { module: "coupon", entityId: id },
        select: {
          action: true,
          meta: true,
          createdAt: true,
          actor: { select: { name: true, email: true } },
        },
        orderBy: { createdAt: "asc" },
        take: 500,
      }),
      db.order.findMany({
        where: { couponId: id },
        select: {
          id: true,
          number: true,
          status: true,
          email: true,
          shippingAddress: true,
          subtotal: true,
          discount: true,
          total: true,
          placedAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 2000,
      }),
    ])

    const events: CouponEvent[] = logs.map((l) => ({
      action: l.action,
      at: l.createdAt.toISOString(),
      by: l.actor?.name ?? l.actor?.email ?? null,
      meta: (l.meta ?? null) as Record<string, unknown> | null,
    }))

    const orders: HistoryOrder[] = placed.map((o) => {
      const address = (o.shippingAddress ?? {}) as { firstName?: string; lastName?: string }
      return {
        id: o.id,
        number: o.number,
        status: o.status,
        customer: [address.firstName, address.lastName].filter(Boolean).join(" ") || "Guest",
        email: o.email,
        at: (o.placedAt ?? o.createdAt).toISOString(),
        subtotal: o.subtotal.toString(),
        discount: o.discount.toString(),
        total: o.total.toString(),
      }
    })

    const runs = splitRuns({
      createdAt: coupon.createdAt,
      current: {
        kind: coupon.kind,
        value: coupon.value,
        minSubtotal: coupon.minSubtotal,
        maxUses: coupon.maxUses,
        expiresAt: coupon.expiresAt,
        usedCount: coupon.usedCount,
      },
      events,
      orders,
    })

    // Orders carry customers' names and emails: only for staff who may read orders.
    const canSeeOrders = can(session, PERMISSIONS.ORDER_READ)
    const runAt = (at: string) => {
      for (let i = runs.length - 1; i >= 0; i--) if (at >= runs[i]!.start) return runs[i]!.index
      return 1
    }

    return ok({
      coupon,
      // Oldest first, so the table's own row number is the run's.
      runs,
      orders: canSeeOrders ? orders.map((o) => ({ ...o, run: runAt(o.at) })) : [],
      canSeeOrders,
      events: [...events].reverse(),
    })
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

    // Every unusable code reads the same, so this cannot reveal which codes exist.
    if (!coupon || !couponIsLive(coupon)) return fail(COUPON_UNUSABLE, undefined, 422)

    const discount = couponReduction(coupon, input.subtotal)
    if (discount <= 0) return fail(minimumSpendMessage(coupon.minSubtotal), undefined, 422)

    return ok({ code: coupon.code, discount, label: offerLabel(coupon) })
  })
}
