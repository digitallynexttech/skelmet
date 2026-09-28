import "server-only"

import { db } from "@/server/db"

/**
 * Other visitor records that are probably the same person - the same phone
 * seen in Chrome and in Brave, say, which keep separate cookies and so arrive
 * as two visitors.
 *
 * Only from what a visitor who accepted cookies already gave us, and nothing
 * gathered for the purpose: no fingerprinting (Brave scrambles it anyway).
 * Two kinds of evidence, and the page says which:
 *
 * - "contact": the same email or phone typed at checkout. As good as proof.
 * - "network": the same connection and the same kind of device within a few
 *   hours. For IPv6 the connection is the /64 prefix - a phone or a home
 *   router's own block - so this is strong. For IPv4 it is the exact address,
 *   which a mobile carrier can share between many subscribers, so it is only
 *   ever a hint.
 *
 * A visitor who refused cookies has no IP address or contact details stored,
 * so is never matched, and never matched to.
 */

export type LinkedVisitor = {
  id: string
  name: string | null
  email: string | null
  browser: string | null
  os: string | null
  deviceModel: string | null
  lastSeenAt: string
  reason: "contact" | "network"
  /** Plain words for the admin: why these are thought to be one person. */
  because: string
}

/** How far apart two visits on one connection may start and still count. */
const NETWORK_WINDOW_MS = 12 * 60 * 60_000
/** Candidate visits read per lookup: a busy day's worth, no more. */
const CANDIDATES = 3000
const SHOWN = 10

/**
 * The part of an address that names one subscriber's connection: the whole
 * address for IPv4, the first four groups (the /64) for IPv6, expanded so
 * "2405:201::1" and "2405:0201:0000:0000::9" compare equal. Null for anything
 * that is not an address.
 */
export function networkKey(ip: string | null | undefined): string | null {
  if (!ip) return null
  const raw = ip.trim().toLowerCase()
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(raw)) return `v4:${raw}`
  // An IPv4-mapped IPv6 address is the IPv4 address.
  const mapped = raw.match(/^::ffff:(\d{1,3}(\.\d{1,3}){3})$/)
  if (mapped) return `v4:${mapped[1]}`
  if (!raw.includes(":") || !/^[0-9a-f:]+$/.test(raw)) return null

  const halves = raw.split("::")
  if (halves.length > 2) return null
  const head = halves[0] ? halves[0].split(":") : []
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : []
  const missing = 8 - head.length - tail.length
  if (halves.length === 1 ? head.length !== 8 : missing < 1) return null
  const groups = [...head, ...Array<string>(halves.length === 2 ? missing : 0).fill("0"), ...tail]
  if (groups.length !== 8 || groups.some((g) => !/^[0-9a-f]{1,4}$/.test(g))) return null
  return `v6:${groups
    .slice(0, 4)
    .map((g) => g.padStart(4, "0"))
    .join(":")}`
}

const digits = (phone: string) => phone.replace(/\D/g, "").slice(-10)

function minutesApart(ms: number): string {
  const m = Math.round(ms / 60_000)
  if (m < 1) return "at the same time"
  if (m < 60) return `${m} min apart`
  const h = Math.round(m / 60)
  return `${h} h apart`
}

type Subject = {
  id: string
  email: string | null
  phone: string | null
  os: string | null
  deviceType: string | null
  sessions: Array<{ ip: string | null; startedAt: Date; lastSeenAt: Date }>
}

export async function findLinkedVisitors(v: Subject): Promise<LinkedVisitor[]> {
  const found = new Map<string, LinkedVisitor>()
  const select = {
    id: true,
    name: true,
    email: true,
    browser: true,
    os: true,
    deviceType: true,
    deviceModel: true,
    lastSeenAt: true,
  } as const

  // Contact first: it outranks a shared connection for the same visitor.
  const phone = v.phone ? digits(v.phone) : ""
  const byContact = [
    ...(v.email ? [{ email: { equals: v.email, mode: "insensitive" as const } }] : []),
    ...(phone.length === 10 ? [{ phone: { endsWith: phone } }] : []),
  ]
  if (byContact.length) {
    const rows = await db.visitor.findMany({
      where: { id: { not: v.id }, anonymous: false, OR: byContact },
      select: { ...select, phone: true },
      orderBy: { lastSeenAt: "desc" },
      take: SHOWN,
    })
    for (const r of rows) {
      const sameEmail = Boolean(v.email && r.email?.toLowerCase() === v.email.toLowerCase())
      found.set(r.id, {
        id: r.id,
        name: r.name,
        email: r.email,
        browser: r.browser,
        os: r.os,
        deviceModel: r.deviceModel,
        lastSeenAt: r.lastSeenAt.toISOString(),
        reason: "contact",
        because: sameEmail ? "Same email typed at checkout" : "Same phone typed at checkout",
      })
    }
  }

  // Then the connection, visit by visit.
  const mine = v.sessions
    .map((s) => ({ key: networkKey(s.ip), from: s.startedAt, to: s.lastSeenAt }))
    .filter((s): s is { key: string; from: Date; to: Date } => s.key !== null)
  if (mine.length) {
    const earliest = Math.min(...mine.map((s) => s.from.getTime())) - NETWORK_WINDOW_MS
    const latest = Math.max(...mine.map((s) => s.to.getTime())) + NETWORK_WINDOW_MS
    const candidates = await db.visitorSession.findMany({
      where: {
        visitorId: { not: v.id },
        ip: { not: null },
        startedAt: { gte: new Date(earliest), lte: new Date(latest) },
      },
      select: {
        ip: true,
        startedAt: true,
        visitor: { select: { ...select, anonymous: true } },
      },
      orderBy: { startedAt: "desc" },
      take: CANDIDATES,
    })

    const best = new Map<string, { gap: number; v4: boolean; row: (typeof candidates)[number] }>()
    for (const c of candidates) {
      const other = c.visitor
      if (other.anonymous || found.has(other.id)) continue
      // Same kind of device, where both are known: a laptop and a phone on
      // one home connection are two people as often as one.
      if (v.os && other.os && v.os !== other.os) continue
      if (v.deviceType && other.deviceType && v.deviceType !== other.deviceType) continue
      const key = networkKey(c.ip)
      if (!key) continue
      for (const s of mine) {
        if (s.key !== key) continue
        const at = c.startedAt.getTime()
        const gap =
          at < s.from.getTime()
            ? s.from.getTime() - at
            : at > s.to.getTime()
              ? at - s.to.getTime()
              : 0
        if (gap > NETWORK_WINDOW_MS) continue
        const prev = best.get(other.id)
        if (!prev || gap < prev.gap) best.set(other.id, { gap, v4: key.startsWith("v4:"), row: c })
      }
    }

    for (const [id, { gap, v4, row }] of best) {
      const other = row.visitor
      const device = [other.deviceModel ?? other.os, other.browser].filter(Boolean).join(", ")
      found.set(id, {
        id,
        name: other.name,
        email: other.email,
        browser: other.browser,
        os: other.os,
        deviceModel: other.deviceModel,
        lastSeenAt: other.lastSeenAt.toISOString(),
        reason: "network",
        because: v4
          ? `Same IP address and device type, ${minutesApart(gap)} - could be a shared mobile network`
          : `Same connection and device type, ${minutesApart(gap)}${device ? ` (${device})` : ""}`,
      })
    }
  }

  return [...found.values()]
    .sort((a, b) =>
      a.reason === b.reason
        ? b.lastSeenAt.localeCompare(a.lastSeenAt)
        : a.reason === "contact"
          ? -1
          : 1,
    )
    .slice(0, SHOWN)
}
