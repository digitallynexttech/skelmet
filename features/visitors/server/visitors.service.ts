import "server-only"

import type { Prisma } from "@prisma/client"

import type {
  CartLineRow,
  LeftCartRow,
  LeftCartsPayload,
  VisitorDetail,
  VisitorListPayload,
  VisitorRow,
  VisitorView,
} from "@/features/visitors/hooks/use-visitors"
import { paginate } from "@/lib/api-response"
import { MAX_PAGE_SIZE, PERMISSIONS } from "@/lib/constants"
import { hasDatabase } from "@/lib/env"
import { fail, ok, runAction, type ActionResult } from "@/server/action-result"
import { requirePermission } from "@/server/action-guard"
import { db } from "@/server/db"
import { findLinkedVisitors } from "@/features/visitors/server/linked-visitors"

/**
 * The console's view of storefront visitors: who came, on what, from where,
 * what they looked at, and the carts they left.
 *
 * Gated on ORDER_READ, as the customer list is: whoever can read the orders
 * already reads every buyer's name, phone and address, and this is the same
 * shop's visitors, most of whom never got that far.
 */

/** Visits are kept a year after they happened; the privacy policy says so. */
const VISIT_RETENTION_DAYS = 365
/** Copied carts are kept 90 days after they last changed; so does the policy. */
const CART_RETENTION_DAYS = 90
/** Seen this recently, a visitor is still shopping rather than gone. */
const BROWSING_MS = 30 * 60_000

/** Orders the shop kept the money for. */
const PAID_STATUSES = { notIn: ["PENDING", "CANCELLED"] as ("PENDING" | "CANCELLED")[] }

let prunedAt = 0

/**
 * Deletes what the privacy policy says is not kept. There is no scheduler on
 * this server, so it runs when staff open these lists - at most once an hour
 * per process, since each run is a delete over an indexed range.
 */
export async function pruneVisitorData(): Promise<void> {
  if (!hasDatabase() || Date.now() - prunedAt < 60 * 60_000) return
  prunedAt = Date.now()
  const day = 86_400_000
  try {
    await db.cart.deleteMany({
      where: {
        visitorId: { not: null },
        updatedAt: { lt: new Date(Date.now() - CART_RETENTION_DAYS * day) },
      },
    })
    const visits = new Date(Date.now() - VISIT_RETENTION_DAYS * day)
    // A visitor still coming back keeps their row; their old visits go.
    await db.visitorSession.deleteMany({ where: { lastSeenAt: { lt: visits } } })
    await db.visitor.deleteMany({ where: { lastSeenAt: { lt: visits } } })
  } catch (err) {
    // Housekeeping. It must never be why a list fails to load.
    console.error("[VISITORS] pruning failed", err)
  }
}

const VIEWS: Record<VisitorView, Prisma.VisitorWhereInput> = {
  all: {},
  known: { anonymous: false },
  anonymous: { anonymous: true },
  contact: { OR: [{ email: { not: null } }, { phone: { not: null } }] },
  cart: { cart: { is: { items: { some: {} } } } },
  bought: { orders: { some: { status: PAID_STATUSES } } },
}

const isView = (v: string | null | undefined): v is VisitorView =>
  Boolean(v && Object.hasOwn(VIEWS, v))

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null)

export async function listVisitors(params: {
  view?: string | null
  q?: string | null
  /** Days back from now; 0 or absent is all time. */
  days?: number | string | null
}): Promise<ActionResult<VisitorListPayload>> {
  return runAction(async () => {
    await requirePermission(PERMISSIONS.ORDER_READ)
    if (!hasDatabase()) return fail("Database not configured.", undefined, 503)
    await pruneVisitorData()

    const view: VisitorView = isView(params.view) ? params.view : "all"
    const days = Number(params.days)
    const q = params.q?.trim()

    // The period and the search narrow every tile; the tile only narrows the list.
    const scope: Prisma.VisitorWhereInput = {
      ...(Number.isFinite(days) && days > 0
        ? { lastSeenAt: { gte: new Date(Date.now() - days * 86_400_000) } }
        : {}),
      ...(q
        ? {
            OR: [
              { email: { contains: q, mode: "insensitive" } },
              { name: { contains: q, mode: "insensitive" } },
              { phone: { contains: q } },
              { city: { contains: q, mode: "insensitive" } },
              { district: { contains: q, mode: "insensitive" } },
              { region: { contains: q, mode: "insensitive" } },
              { ip: { startsWith: q } },
              { source: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    }
    const where: Prisma.VisitorWhereInput = { AND: [scope, VIEWS[view]] }

    const [rows, total, ...tallies] = await Promise.all([
      db.visitor.findMany({
        where,
        orderBy: { lastSeenAt: "desc" },
        take: MAX_PAGE_SIZE,
        select: {
          id: true,
          anonymous: true,
          name: true,
          email: true,
          phone: true,
          ip: true,
          city: true,
          district: true,
          region: true,
          country: true,
          deviceType: true,
          deviceModel: true,
          os: true,
          browser: true,
          source: true,
          medium: true,
          campaign: true,
          landingPage: true,
          referrer: true,
          visitCount: true,
          pageviews: true,
          engagedSeconds: true,
          firstSeenAt: true,
          lastSeenAt: true,
          cart: { select: { items: { select: { qty: true, unitPrice: true } } } },
          orders: { where: { status: PAID_STATUSES }, select: { total: true } },
        },
      }),
      db.visitor.count({ where }),
      ...(Object.keys(VIEWS) as VisitorView[]).map((v) =>
        db.visitor.count({ where: { AND: [scope, VIEWS[v]] } }),
      ),
    ])

    const counts = Object.fromEntries(
      (Object.keys(VIEWS) as VisitorView[]).map((v, i) => [v, tallies[i] ?? 0]),
    ) as Record<VisitorView, number>

    const data: VisitorRow[] = rows.map(({ cart, orders, ...v }) => {
      const items = cart?.items ?? []
      return {
        ...v,
        cartItems: items.reduce((n, i) => n + i.qty, 0),
        cartValue: items.reduce((sum, i) => sum + Number(i.unitPrice) * i.qty, 0).toFixed(2),
        orders: orders.length,
        spent: orders.reduce((sum, o) => sum + Number(o.total), 0).toFixed(2),
        firstSeenAt: v.firstSeenAt.toISOString(),
        lastSeenAt: v.lastSeenAt.toISOString(),
      }
    })

    return ok({ ...paginate(data, 1, MAX_PAGE_SIZE, total), counts })
  })
}

const LINE_SELECT = {
  qty: true,
  unitPrice: true,
  variant: { select: { sku: true, colourway: true, product: { select: { name: true } } } },
} as const

function cartLines(
  items: Array<{
    qty: number
    unitPrice: { toString(): string }
    variant: { sku: string; colourway: string; product: { name: string } }
  }>,
): CartLineRow[] {
  return items.map((i) => ({
    name: i.variant.product.name,
    colourway: i.variant.colourway,
    sku: i.variant.sku,
    qty: i.qty,
    unitPrice: i.unitPrice.toString(),
  }))
}

const value = (lines: CartLineRow[]) =>
  lines.reduce((sum, l) => sum + Number(l.unitPrice) * l.qty, 0).toFixed(2)

/** The most recent visits shown on a visitor's page, and the events shown per visit. */
const SESSIONS_SHOWN = 25
const EVENTS_PER_SESSION = 150

export async function getVisitor(id: string): Promise<ActionResult<VisitorDetail>> {
  return runAction(async () => {
    await requirePermission(PERMISSIONS.ORDER_READ)
    if (!hasDatabase()) return fail("Database not configured.", undefined, 503)

    // A malformed id is simply not a visitor, not a database error.
    if (!/^[0-9a-f-]{36}$/i.test(id)) return fail("No such visitor.", undefined, 404)

    const v = await db.visitor.findUnique({
      where: { id },
      select: {
        id: true,
        anonymous: true,
        consentAt: true,
        name: true,
        email: true,
        phone: true,
        ip: true,
        city: true,
        district: true,
        region: true,
        country: true,
        postalCode: true,
        pincode: true,
        latitude: true,
        longitude: true,
        userAgent: true,
        deviceType: true,
        deviceModel: true,
        os: true,
        browser: true,
        screen: true,
        language: true,
        timezone: true,
        source: true,
        medium: true,
        campaign: true,
        landingPage: true,
        referrer: true,
        visitCount: true,
        pageviews: true,
        engagedSeconds: true,
        firstSeenAt: true,
        lastSeenAt: true,
        user: { select: { id: true, name: true, email: true } },
        cart: {
          select: { updatedAt: true, checkoutAt: true, items: { select: LINE_SELECT } },
        },
        orders: {
          select: { id: true, number: true, status: true, total: true, createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 50,
        },
        sessions: {
          orderBy: { startedAt: "desc" },
          take: SESSIONS_SHOWN,
          select: {
            id: true,
            startedAt: true,
            lastSeenAt: true,
            pageviews: true,
            engagedSeconds: true,
            landingPage: true,
            exitPage: true,
            source: true,
            medium: true,
            campaign: true,
            referrer: true,
            ip: true,
            city: true,
            district: true,
            region: true,
            events: {
              orderBy: { createdAt: "asc" },
              take: EVENTS_PER_SESSION,
              select: {
                id: true,
                type: true,
                path: true,
                seconds: true,
                data: true,
                createdAt: true,
              },
            },
          },
        },
      },
    })
    if (!v) return fail("No such visitor.", undefined, 404)

    const { user, cart, orders, sessions, ...rest } = v
    const lines = cart ? cartLines(cart.items) : []
    // Only a visitor who accepted has the details a match needs.
    const linked = v.anonymous ? [] : await findLinkedVisitors(v)

    return ok({
      ...rest,
      consentAt: iso(v.consentAt),
      firstSeenAt: v.firstSeenAt.toISOString(),
      lastSeenAt: v.lastSeenAt.toISOString(),
      customer: user,
      linked,
      cart:
        cart && lines.length
          ? {
              updatedAt: cart.updatedAt.toISOString(),
              checkoutAt: iso(cart.checkoutAt),
              value: value(lines),
              items: lines,
            }
          : null,
      orders: orders.map((o) => ({
        id: o.id,
        number: o.number,
        status: o.status,
        total: o.total.toString(),
        createdAt: o.createdAt.toISOString(),
      })),
      sessions: sessions.map((s) => ({
        ...s,
        startedAt: s.startedAt.toISOString(),
        lastSeenAt: s.lastSeenAt.toISOString(),
        events: s.events.map((e) => ({
          ...e,
          data: (e.data ?? null) as Record<string, unknown> | null,
          createdAt: e.createdAt.toISOString(),
        })),
      })),
    })
  })
}

/**
 * Baskets filled and never turned into an order.
 *
 * A basket an order was placed from is not here: the tracker empties it when
 * the order is placed, and in case that message was lost, any basket that has
 * not changed since its visitor's latest order is dropped below too. Whether
 * that order was then paid for is the other tab's question.
 */
export async function listLeftCarts(): Promise<ActionResult<LeftCartsPayload>> {
  return runAction(async () => {
    await requirePermission(PERMISSIONS.ORDER_READ)
    if (!hasDatabase()) return fail("Database not configured.", undefined, 503)
    await pruneVisitorData()

    const carts = await db.cart.findMany({
      where: { visitorId: { not: null }, items: { some: {} } },
      orderBy: { updatedAt: "desc" },
      // Some are dropped below, so read past the window rather than come up short.
      take: MAX_PAGE_SIZE * 2,
      select: {
        id: true,
        updatedAt: true,
        checkoutAt: true,
        items: { select: LINE_SELECT },
        visitor: {
          select: {
            id: true,
            anonymous: true,
            name: true,
            email: true,
            phone: true,
            city: true,
            district: true,
            region: true,
            deviceType: true,
            deviceModel: true,
            os: true,
            browser: true,
            source: true,
            lastSeenAt: true,
          },
        },
      },
    })

    const visitorIds = carts.flatMap((c) => (c.visitor ? [c.visitor.id] : []))
    const oldest = carts.at(-1)?.updatedAt
    const orders =
      visitorIds.length && oldest
        ? await db.order.findMany({
            where: { visitorId: { in: visitorIds }, createdAt: { gte: oldest } },
            select: { visitorId: true, createdAt: true },
          })
        : []

    const now = Date.now()
    const data: LeftCartRow[] = []
    for (const c of carts) {
      const v = c.visitor
      if (!v) continue
      if (orders.some((o) => o.visitorId === v.id && o.createdAt >= c.updatedAt)) continue
      const lines = cartLines(c.items)
      data.push({
        id: c.id,
        visitorId: v.id,
        anonymous: v.anonymous,
        name: v.name,
        email: v.email,
        phone: v.phone,
        city: v.city,
        district: v.district,
        region: v.region,
        deviceType: v.deviceType,
        deviceModel: v.deviceModel,
        os: v.os,
        browser: v.browser,
        source: v.source,
        items: lines,
        itemCount: lines.reduce((n, l) => n + l.qty, 0),
        value: value(lines),
        checkoutAt: iso(c.checkoutAt),
        updatedAt: c.updatedAt.toISOString(),
        browsingNow: now - v.lastSeenAt.getTime() < BROWSING_MS,
      })
      if (data.length === MAX_PAGE_SIZE) break
    }

    return ok({
      data,
      summary: {
        count: data.length,
        value: data.reduce((sum, r) => sum + Number(r.value), 0).toFixed(2),
        withContact: data.filter((r) => r.email || r.phone).length,
        reachedCheckout: data.filter((r) => r.checkoutAt).length,
      },
    })
  })
}
