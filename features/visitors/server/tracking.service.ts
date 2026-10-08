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

// Server half of the visit tracker (browser half: lib/tracker.ts).
// Without consent (consent false) a visit is one row, with no cookie, IP address,
// pincode, contact details or link to a person. With consent: the cookie, IP, phone
// model and order link. The bar now always sends consent (consent-bar.tsx).

/** Past this many pages in one visit, a script rather than a person. */
const MAX_VIEWS_PER_VISIT = 300

/** More than an hour on one page is a tab left open. */
const MAX_SECONDS_PER_VIEW = 3600

/** The privacy policy promises 90 days. */
const CART_DAYS = 90

type Line = { sku: string; qty: number }
type Resolved = { id: string; anonymous: boolean }
type Visit = { id: string; pageviews: number }

const VISITOR = { id: true, anonymous: true } as const
const SESSION = { id: true, pageviews: true } as const

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Error && (err as { code?: unknown }).code === "P2002"
}

type Facts = {
  ip: string | null
  country: string | null
  region: string | null
  city: string | null
  /** From the pincode, once looked up (district.ts). */
  district: string | null
  postalCode: string | null
  latitude: number | null
  longitude: number | null
  userAgent: string
  host: string | null
}

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
    // Never the first X-Forwarded-For entry: the browser can forge it.
    ip: trustedClientIp(h),
    // XX is "unknown", T1 is Tor.
    country: country && country !== "XX" && country !== "T1" ? country : null,
    // Need Cloudflare's "Add visitor location headers" managed transform; absent in dev.
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

/** Null means "leave it": a request without Cloudflare's headers must not wipe a city. */
const keep = <T>(value: T | null | undefined): T | undefined => value ?? undefined

type Device = Extract<VisitInput, { t: "view" }>["device"]

// Privacy: IP, pincode area, phone model and raw user agent only for a visitor who accepted.
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

// Accepting mid-visit keeps the pages seen so far: the visit's anonymous row
// becomes the device's, or is folded into the device the cookie already names.
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

  // Every time, so the year runs from the last visit.
  await keepVisitorCookie(visitor.id)
  return visitor
}

async function foldInto(knownId: string, anonId: string, sid: string): Promise<void> {
  await db.$transaction(async (tx) => {
    // The device may already hold this visit (choice cleared mid-tab): merge
    // into it rather than counting a second visit.
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

    // The visit's cart is the newer, so it wins.
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

// Priced from the database: the browser only says what and how many.
async function mirrorCart(
  visitorId: string,
  items: Line[],
  checkout: boolean,
  now: Date,
): Promise<string> {
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

// View id and visit key are both random and must match: only that visit can add time.
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

// Consent withdrawn: drop the cookie and everything identifying; the pages stay, anonymous.
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
    // The order number would lead back to a name.
    db.visitorEvent.updateMany({
      where: { visitorId: id, type: "placed" },
      data: { data: Prisma.DbNull },
    }),
  ])
}

/** Public and unauthenticated: answers the same whatever happened, never reads data back out. */
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

    if ((await optionalSession())?.user?.kind === "STAFF") return ok({ recorded: false })

    if (input.t === "time") return ok({ recorded: await addTime(input) })

    // Consent withdrawn: forget before anything else is written.
    if (input.t === "consent" && !input.consent) {
      await forgetDevice()
      return ok({ recorded: true })
    }

    // The pincode only finds the district; never stored for a visitor who refused.
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
          // Duplicate delivery.
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
        // Typed, not submitted: kept only with consent.
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
        // Became an order, so not abandoned (paid or not).
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

/** Links an order to its visitor, only if that visitor accepted cookies. */
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
    // Must never fail an order.
    console.error("[VISITORS] could not link order", input.orderId, err)
  }
}
