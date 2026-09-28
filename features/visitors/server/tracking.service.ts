import "server-only"

import { Prisma } from "@prisma/client"
import { headers } from "next/headers"

import { visitSchema, type VisitInput } from "@/features/visitors/schemas/visit.schema"
import { arrivalOf, cleanPath, type Arrival } from "@/features/visitors/server/attribution"
import { fillDistrictLater, knownDistrict, visitPincode } from "@/features/visitors/server/district"
import { describeAgent, type Agent } from "@/features/visitors/server/user-agent"
import {
  dropVisitorCookie,
  keepVisitorCookie,
  visitorCookie,
} from "@/features/visitors/server/visitor-cookie"
import { hasDatabase } from "@/lib/env"
import { trustedClientIp } from "@/lib/rate-limit"
import { ok, runAction, type ActionResult } from "@/server/action-result"
import { optionalSession } from "@/server/action-guard"
import { db } from "@/server/db"

/**
 * The storefront's visit tracker, server half. The browser half is
 * features/visitors/lib/tracker.ts; the choice it acts on is the cookie bar.
 *
 * What is kept depends on that choice, and only ever in one direction - a
 * visitor who has not accepted is recorded with less, never more:
 *
 * - Accepted: a year-long cookie recognises the device, and its row holds the
 *   IP address, the phone model, the details typed at checkout, and a link to
 *   its orders.
 * - Not accepted (refused, or not answered yet): one row per visit, found by
 *   the tab's own key. The pages, the time, the device type, the area (city,
 *   district, state) and the cart - no cookie, no IP address, no pincode, no
 *   contact details, no link to anyone.
 */

/** Past this many pages in one visit the rest are not written: a script, not a person. */
const MAX_VIEWS_PER_VISIT = 300

/** More than an hour on one page is a tab left open, however it was reported. */
const MAX_SECONDS_PER_VIEW = 3600

/** How long a copied cart is kept after it last changed; the privacy policy says 90 days. */
const CART_DAYS = 90

type Line = { sku: string; qty: number }
type Resolved = { id: string; anonymous: boolean }
type Visit = { id: string; pageviews: number }

const VISITOR = { id: true, anonymous: true } as const
const SESSION = { id: true, pageviews: true } as const

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Error && (err as { code?: unknown }).code === "P2002"
}

/** What the request itself says: where it came from, and what sent it. */
type Facts = {
  ip: string | null
  country: string | null
  region: string | null
  city: string | null
  /** From the pincode, when it has been looked up before (district.ts). */
  district: string | null
  postalCode: string | null
  latitude: number | null
  longitude: number | null
  userAgent: string
  host: string | null
}

/** A coordinate header as a number, or null when absent or out of range. */
function coordinate(raw: string | null, limit: number): number | null {
  if (!raw) return null
  const n = Number(raw)
  return Number.isFinite(n) && Math.abs(n) <= limit ? n : null
}

async function requestFacts(): Promise<Facts> {
  const h = await headers()
  const value = (name: string) => h.get(name)?.trim() || null
  const country = value("cf-ipcountry")
  return {
    // The address nginx vouches for (lib/rate-limit.ts), never the first
    // X-Forwarded-For entry, which is whatever the browser chose to claim.
    ip: trustedClientIp(h),
    // XX is "unknown" and T1 is Tor - neither is a country.
    country: country && country !== "XX" && country !== "T1" ? country : null,
    // Cloudflare adds these once "Add visitor location headers" is switched
    // on (Rules > Transform Rules > Managed Transforms). Without it, and in
    // development, they are simply absent.
    region: value("cf-region"),
    city: value("cf-ipcity"),
    district: null,
    postalCode: value("cf-postal-code"),
    latitude: coordinate(value("cf-iplatitude"), 90),
    longitude: coordinate(value("cf-iplongitude"), 180),
    userAgent: (h.get("user-agent") ?? "").slice(0, 500),
    host: value("x-forwarded-host") ?? value("host"),
  }
}

/** Nulls become "leave it": a request without Cloudflare's headers must not wipe a city. */
const keep = <T>(value: T | null | undefined): T | undefined => value ?? undefined

type Device = Extract<VisitInput, { t: "view" }>["device"]

/**
 * The visitor's device and place, as written on every page view.
 *
 * The finer detail - IP address, pincode area, phone model, the raw user
 * agent - only for a visitor who accepted. Together with the rest it narrows
 * one device down a long way, which is exactly what a visitor who refused has
 * asked us not to do.
 */
function profile(agent: Agent, facts: Facts, device: Device, identified: boolean) {
  return {
    deviceType: agent.deviceType,
    os: keep(agent.os),
    browser: keep(agent.browser),
    screen: keep(device?.screen),
    language: keep(device?.lang),
    timezone: keep(device?.tz),
    country: keep(facts.country),
    region: keep(facts.region),
    city: keep(facts.city),
    district: keep(facts.district),
    ...(identified
      ? {
          ip: keep(facts.ip),
          postalCode: keep(facts.postalCode),
          latitude: keep(facts.latitude),
          longitude: keep(facts.longitude),
          deviceModel: keep(agent.deviceModel),
          userAgent: keep(facts.userAgent || null),
        }
      : {}),
  }
}

function arrivalFor(input: VisitInput, facts: Facts): Arrival | null {
  if (input.t !== "view") return null
  return arrivalOf({
    path: input.path,
    referrer: input.ref,
    ownHost: facts.host,
    userAgent: facts.userAgent,
  })
}

/**
 * Finds the visitor this message belongs to, creating it on first contact.
 *
 * With consent, that is the device the cookie names. A visitor who accepts
 * part-way through a visit keeps the pages they saw before: the anonymous row
 * for this visit becomes theirs, or - if the device was already known, its
 * cookie outliving a cleared choice - is folded into it.
 */
async function resolveVisitor(
  input: VisitInput,
  facts: Facts,
  agent: Agent,
  now: Date,
): Promise<Resolved> {
  const arrival = arrivalFor(input, facts)
  const identified = input.consent
  const device = input.t === "view" ? input.device : undefined
  const seed = {
    firstSeenAt: now,
    lastSeenAt: now,
    ...profile(agent, facts, device, identified),
    referrer: arrival?.referrer,
    source: arrival?.source,
    medium: arrival?.medium,
    campaign: arrival?.campaign,
    landingPage: input.t === "view" ? cleanPath(input.path) : undefined,
  } satisfies Prisma.VisitorCreateInput

  const thisVisit = await db.visitor.findUnique({ where: { anonKey: input.sid }, select: VISITOR })

  if (!identified) {
    if (thisVisit) return thisVisit
    try {
      return await db.visitor.create({
        data: { ...seed, anonymous: true, anonKey: input.sid },
        select: VISITOR,
      })
    } catch (err) {
      // Two messages from the same new visit, both first.
      if (!isUniqueViolation(err)) throw err
      return db.visitor.findUniqueOrThrow({ where: { anonKey: input.sid }, select: VISITOR })
    }
  }

  const cookieId = await visitorCookie()
  const known = cookieId
    ? await db.visitor.findFirst({ where: { id: cookieId, anonymous: false }, select: VISITOR })
    : null

  let visitor: Resolved
  if (known) {
    if (thisVisit) await foldInto(known.id, thisVisit.id, input.sid)
    visitor = known
  } else if (thisVisit) {
    visitor = await db.visitor.update({
      where: { id: thisVisit.id },
      data: {
        anonymous: false,
        anonKey: null,
        consentAt: now,
        ...profile(agent, facts, device, true),
      },
      select: VISITOR,
    })
    // The visit so far was recorded without its IP address; it has one now.
    await db.visitorSession.updateMany({
      where: { visitorId: visitor.id, key: input.sid },
      data: { ip: facts.ip },
    })
  } else {
    visitor = await db.visitor.create({
      data: { ...seed, anonymous: false, consentAt: now },
      select: VISITOR,
    })
  }

  // Every time, so the year runs from the last visit rather than the first.
  await keepVisitorCookie(visitor.id)
  return visitor
}

/** Moves one anonymous visit's record into the device it turned out to be. */
async function foldInto(knownId: string, anonId: string, sid: string): Promise<void> {
  await db.$transaction(async (tx) => {
    // The device may already have this very visit on record - the tab was
    // known before its choice was cleared - and a visitor holds a visit
    // once. Then the anonymous stretch joins that visit instead of moving in
    // beside it, and it is not counted as a visit of its own.
    const same = await tx.visitorSession.findUnique({
      where: { visitorId_key: { visitorId: knownId, key: sid } },
      select: { id: true },
    })
    if (same) {
      const stretch = await tx.visitorSession.findUnique({
        where: { visitorId_key: { visitorId: anonId, key: sid } },
        select: { id: true, pageviews: true, engagedSeconds: true },
      })
      if (stretch) {
        await tx.visitorEvent.updateMany({
          where: { sessionId: stretch.id },
          data: { visitorId: knownId, sessionId: same.id },
        })
        await tx.visitorSession.update({
          where: { id: same.id },
          data: {
            pageviews: { increment: stretch.pageviews },
            engagedSeconds: { increment: stretch.engagedSeconds },
          },
        })
        await tx.visitorSession.delete({ where: { id: stretch.id } })
      }
    }
    await tx.visitorSession.updateMany({
      where: { visitorId: anonId },
      data: { visitorId: knownId },
    })
    await tx.visitorEvent.updateMany({ where: { visitorId: anonId }, data: { visitorId: knownId } })

    // The visit's cart is the newer of the two, so it is the one kept.
    const cart = await tx.cart.findUnique({ where: { visitorId: anonId }, select: { id: true } })
    if (cart) {
      await tx.cart.deleteMany({ where: { visitorId: knownId } })
      await tx.cart.update({ where: { id: cart.id }, data: { visitorId: knownId } })
    }

    const anon = await tx.visitor.delete({
      where: { id: anonId },
      select: { visitCount: true, pageviews: true, engagedSeconds: true },
    })
    await tx.visitor.update({
      where: { id: knownId },
      data: {
        visitCount: { increment: same ? 0 : anon.visitCount },
        pageviews: { increment: anon.pageviews },
        engagedSeconds: { increment: anon.engagedSeconds },
      },
    })
  })
}

async function resolveSession(
  visitor: Resolved,
  input: VisitInput,
  facts: Facts,
  now: Date,
): Promise<Visit> {
  const where = { visitorId_key: { visitorId: visitor.id, key: input.sid } }
  const found = await db.visitorSession.findUnique({ where, select: SESSION })
  if (found) return found

  const arrival = arrivalFor(input, facts)
  try {
    const created = await db.visitorSession.create({
      data: {
        visitorId: visitor.id,
        key: input.sid,
        startedAt: now,
        lastSeenAt: now,
        landingPage: input.t === "view" ? cleanPath(input.path) : null,
        referrer: arrival?.referrer ?? null,
        source: arrival?.source ?? null,
        medium: arrival?.medium ?? null,
        campaign: arrival?.campaign ?? null,
        ip: visitor.anonymous ? null : facts.ip,
        city: facts.city,
        region: facts.region,
        district: facts.district,
      },
      select: SESSION,
    })
    await db.visitor.update({ where: { id: visitor.id }, data: { visitCount: { increment: 1 } } })
    return created
  } catch (err) {
    if (!isUniqueViolation(err)) throw err
    return db.visitorSession.findUniqueOrThrow({ where, select: SESSION })
  }
}

async function note(
  visitor: Resolved,
  visit: Visit,
  type: string,
  data?: Prisma.InputJsonValue,
): Promise<void> {
  await db.visitorEvent.create({
    data: { visitorId: visitor.id, sessionId: visit.id, type, ...(data ? { data } : {}) },
  })
}

async function touch(visitor: Resolved, visit: Visit, now: Date): Promise<void> {
  await db.visitorSession.update({ where: { id: visit.id }, data: { lastSeenAt: now } })
  await db.visitor.update({ where: { id: visitor.id }, data: { lastSeenAt: now } })
}

/**
 * Copies the browser's cart, priced from the database as checkout prices it:
 * the browser only says what and how many.
 */
async function mirrorCart(
  visitorId: string,
  items: Line[],
  checkout: boolean,
  now: Date,
): Promise<string> {
  // The same SKU twice is one line, as the browser's cart keeps it.
  const qtyBySku = new Map<string, number>()
  for (const item of items) {
    qtyBySku.set(item.sku, Math.min(9, (qtyBySku.get(item.sku) ?? 0) + item.qty))
  }

  const variants = qtyBySku.size
    ? await db.variant.findMany({
        where: { sku: { in: [...qtyBySku.keys()] } },
        select: { id: true, sku: true, price: true },
      })
    : []
  const lines = variants.map((v) => ({
    variantId: v.id,
    qty: qtyBySku.get(v.sku) ?? 1,
    unitPrice: v.price,
  }))
  const expiresAt = new Date(now.getTime() + CART_DAYS * 86_400_000)

  if (lines.length === 0) {
    // Emptied: nothing left behind. An empty cart is not worth a row of its own.
    await db.cartItem.deleteMany({ where: { cart: { visitorId } } })
    await db.cart.updateMany({ where: { visitorId }, data: { checkoutAt: null, expiresAt } })
    return "0.00"
  }

  await db.$transaction(async (tx) => {
    const cart = await tx.cart.upsert({
      where: { visitorId },
      create: { visitorId, expiresAt, checkoutAt: checkout ? now : null },
      update: { expiresAt, ...(checkout ? { checkoutAt: now } : {}) },
      select: { id: true },
    })
    await tx.cartItem.deleteMany({ where: { cartId: cart.id } })
    await tx.cartItem.createMany({ data: lines.map((l) => ({ ...l, cartId: cart.id })) })
  })

  return lines.reduce((sum, l) => sum + Number(l.unitPrice) * l.qty, 0).toFixed(2)
}

/**
 * Adds time to the page it was spent on. Only the visit that saw the page can:
 * the view's id and the visit's key are both random, and both must match.
 */
async function addTime(input: { pv: string; sid: string; s: number }): Promise<boolean> {
  const view = await db.visitorEvent.findFirst({
    where: { id: input.pv, type: "view", session: { key: input.sid } },
    select: { id: true, sessionId: true, visitorId: true },
  })
  if (!view) return false

  const added = await db.visitorEvent.updateMany({
    where: { id: view.id, seconds: { lte: MAX_SECONDS_PER_VIEW - input.s } },
    data: { seconds: { increment: input.s } },
  })
  if (added.count === 0) return false

  const now = new Date()
  await db.visitorSession.update({
    where: { id: view.sessionId },
    data: { engagedSeconds: { increment: input.s }, lastSeenAt: now },
  })
  await db.visitor.update({
    where: { id: view.visitorId },
    data: { engagedSeconds: { increment: input.s }, lastSeenAt: now },
  })
  return true
}

/**
 * A visitor who took their consent back. The cookie goes, and so does
 * everything that said who or where they were; what they looked at stays, as
 * an anonymous record like any other refused visit.
 */
async function forgetDevice(): Promise<void> {
  const id = await visitorCookie()
  if (!id) return
  await dropVisitorCookie()
  await db.$transaction([
    db.visitor.updateMany({
      where: { id, anonymous: false },
      data: {
        anonymous: true,
        consentAt: null,
        ip: null,
        postalCode: null,
        pincode: null,
        latitude: null,
        longitude: null,
        userAgent: null,
        deviceModel: null,
        email: null,
        phone: null,
        name: null,
        userId: null,
      },
    }),
    db.visitorSession.updateMany({ where: { visitorId: id }, data: { ip: null } }),
    db.order.updateMany({ where: { visitorId: id }, data: { visitorId: null } }),
    // "Placed order SKM-..." would lead straight back to the name on it.
    db.visitorEvent.updateMany({
      where: { visitorId: id, type: "placed" },
      data: { data: Prisma.DbNull },
    }),
  ])
}

/**
 * One message from the tracker. Public and unauthenticated, so it answers the
 * same small nothing whatever happened, and never reads anything back out.
 */
export async function recordVisit(raw: unknown): Promise<ActionResult<{ recorded: boolean }>> {
  return runAction(async () => {
    if (!hasDatabase()) return ok({ recorded: false })
    const input = visitSchema.parse(raw)

    const facts = await requestFacts()
    const device = input.t === "view" ? input.device : undefined
    const agent = describeAgent(facts.userAgent, {
      model: device?.model,
      platformVersion: device?.platformVersion,
      touch: device?.touch,
    })
    if (agent.bot) return ok({ recorded: false })

    // Staff browsing their own shop are not visitors.
    if ((await optionalSession())?.user?.kind === "STAFF") return ok({ recorded: false })

    if (input.t === "time") return ok({ recorded: await addTime(input) })

    // Taken back: forgotten before anything else is written.
    if (input.t === "consent" && !input.consent) {
      await forgetDevice()
      return ok({ recorded: true })
    }

    // The pincode only finds the district; it is kept for nobody who refused.
    const pincode = visitPincode(facts)
    const district = pincode ? await knownDistrict(pincode) : undefined
    facts.district = district ?? null

    const now = new Date()
    const visitor = await resolveVisitor(input, facts, agent, now)
    const visit = await resolveSession(visitor, input, facts, now)
    if (pincode && district === undefined) fillDistrictLater(pincode, visitor.id, visit.id)

    switch (input.t) {
      case "view": {
        const path = cleanPath(input.path)
        if (visit.pageviews >= MAX_VIEWS_PER_VISIT) {
          await touch(visitor, visit, now)
          return ok({ recorded: false })
        }
        try {
          await db.visitorEvent.create({
            data: {
              id: input.pv,
              visitorId: visitor.id,
              sessionId: visit.id,
              type: "view",
              path,
            },
          })
        } catch (err) {
          // The same view delivered twice.
          if (isUniqueViolation(err)) return ok({ recorded: false })
          throw err
        }
        await db.visitorSession.update({
          where: { id: visit.id },
          data: { pageviews: { increment: 1 }, exitPage: path, lastSeenAt: now },
        })
        await db.visitor.update({
          where: { id: visitor.id },
          data: {
            pageviews: { increment: 1 },
            lastSeenAt: now,
            ...profile(agent, facts, input.device, !visitor.anonymous),
          },
        })
        return ok({ recorded: true })
      }

      case "cart": {
        const value = await mirrorCart(visitor.id, input.items, Boolean(input.checkout), now)
        await note(visitor, visit, input.checkout ? "checkout" : "cart", {
          items: input.items,
          value,
        })
        await touch(visitor, visit, now)
        return ok({ recorded: true })
      }

      case "contact": {
        // Typed, not submitted: kept only for someone who said we could.
        if (visitor.anonymous) return ok({ recorded: false })
        const given = {
          email: input.email?.toLowerCase(),
          phone: input.phone,
          name: input.name,
          pincode: input.pincode,
        }
        const fields = Object.entries(given)
          .filter(([, v]) => v)
          .map(([k]) => k)
        if (fields.length === 0) return ok({ recorded: false })
        await db.visitor.update({ where: { id: visitor.id }, data: { ...given, lastSeenAt: now } })
        await note(visitor, visit, "contact", { fields })
        return ok({ recorded: true })
      }

      case "placed": {
        // The basket became an order, so it was not left behind. Whether that
        // order is ever paid is the orders list's business.
        await db.cartItem.deleteMany({ where: { cart: { visitorId: visitor.id } } })
        await db.cart.updateMany({ where: { visitorId: visitor.id }, data: { checkoutAt: null } })
        await note(
          visitor,
          visit,
          "placed",
          !visitor.anonymous && input.number ? { number: input.number } : undefined,
        )
        await touch(visitor, visit, now)
        return ok({ recorded: true })
      }

      case "consent": {
        await note(visitor, visit, "consent", { granted: true })
        return ok({ recorded: true })
      }
    }
  })
}

/**
 * Ties an order to the visitor who placed it - called by checkout once the
 * order exists. Only a visitor who accepted cookies has anything to tie: a
 * visit made without consent stays unconnected to the person who then bought.
 */
export async function attachOrderToVisitor(input: {
  orderId: string
  email: string
  phone: string
  name: string
}): Promise<void> {
  if (!hasDatabase()) return
  try {
    const id = await visitorCookie()
    if (!id) return
    const visitor = await db.visitor.findFirst({
      where: { id, anonymous: false },
      select: { id: true },
    })
    if (!visitor) return

    const email = input.email.toLowerCase()
    const customer = await db.user.findFirst({
      where: { email, kind: "CUSTOMER" },
      select: { id: true },
    })

    await db.order.update({ where: { id: input.orderId }, data: { visitorId: visitor.id } })
    await db.visitor.update({
      where: { id: visitor.id },
      data: {
        email,
        phone: input.phone,
        ...(input.name ? { name: input.name } : {}),
        ...(customer ? { userId: customer.id } : {}),
      },
    })
  } catch (err) {
    // Bookkeeping about who browsed. It must never be why an order fails.
    console.error("[VISITORS] could not link order", input.orderId, err)
  }
}
