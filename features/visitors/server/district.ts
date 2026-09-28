import "server-only"

import { PINCODE } from "@/lib/india"
import { db } from "@/server/db"
import { later } from "@/server/later"

/**
 * The district a visit comes from.
 *
 * Cloudflare places a visitor at a pincode, worked out from their connection
 * (so approximate - often the telephone exchange, not the house), but names no
 * district. India Post's public directory does, per pincode. Each pincode is
 * asked about once and remembered in `pincode_places`, so a visit only ever
 * reads the table; a pincode seen for the first time is looked up after the
 * response and written onto the visit then.
 */

const INDIA_POST = "https://api.postalpincode.in/pincode/"

type PostOffice = { District?: unknown; State?: unknown; DeliveryStatus?: unknown }

/**
 * The district most of a pincode's post offices are filed under - a pincode
 * can straddle two - preferring those that deliver. Null when India Post has
 * no such pincode.
 */
export function placeFromIndiaPost(
  body: unknown,
): { district: string; state: string | null } | null {
  const first = Array.isArray(body) ? (body[0] as { Status?: unknown; PostOffice?: unknown }) : null
  if (!first || first.Status !== "Success" || !Array.isArray(first.PostOffice)) return null

  const offices = (first.PostOffice as PostOffice[]).filter(
    (o) => typeof o.District === "string" && o.District.trim(),
  )
  const delivering = offices.filter((o) => o.DeliveryStatus === "Delivery")
  const counted = new Map<string, { n: number; state: string | null }>()
  for (const o of delivering.length ? delivering : offices) {
    const district = (o.District as string).trim()
    const seen = counted.get(district)
    counted.set(district, {
      n: (seen?.n ?? 0) + 1,
      state: typeof o.State === "string" ? o.State.trim() : null,
    })
  }
  const [best] = [...counted].sort((a, b) => b[1].n - a[1].n)
  return best ? { district: best[0], state: best[1].state } : null
}

/** An Indian pincode Cloudflare gave for this visit, if it gave one. */
export function visitPincode(facts: {
  country: string | null
  postalCode: string | null
}): string | null {
  const pin = facts.postalCode?.trim() ?? ""
  return (facts.country === "IN" || facts.country === null) && PINCODE.test(pin) ? pin : null
}

/**
 * The district already on file for a pincode. Undefined when it has never
 * been looked up; null when India Post has no such pincode.
 */
export async function knownDistrict(pincode: string): Promise<string | null | undefined> {
  const place = await db.pincodePlace.findUnique({
    where: { pincode },
    select: { district: true },
  })
  return place ? place.district : undefined
}

// One lookup per pincode at a time, however many visits arrive from it at once.
const shared = globalThis as unknown as {
  skelmetDistrictLookups?: Map<string, Promise<string | null>>
}
const inFlight = (shared.skelmetDistrictLookups ??= new Map())

async function lookUp(pincode: string): Promise<string | null> {
  const res = await fetch(`${INDIA_POST}${pincode}`, {
    signal: AbortSignal.timeout(8000),
    headers: { accept: "application/json" },
  })
  if (!res.ok) throw new Error(`India Post answered ${res.status}`)
  const place = placeFromIndiaPost(await res.json())
  await db.pincodePlace.upsert({
    where: { pincode },
    create: { pincode, district: place?.district ?? null, state: place?.state ?? null },
    update: {
      district: place?.district ?? null,
      state: place?.state ?? null,
      lookedUpAt: new Date(),
    },
  })
  return place?.district ?? null
}

/**
 * After the response: looks the pincode up, remembers it, and writes the
 * district onto the visit and the visitor. A failed lookup is not remembered,
 * so the next visit from there tries again.
 */
export function fillDistrictLater(pincode: string, visitorId: string, sessionId: string): void {
  later(async () => {
    try {
      let pending = inFlight.get(pincode)
      if (!pending) {
        pending = lookUp(pincode).finally(() => inFlight.delete(pincode))
        inFlight.set(pincode, pending)
      }
      const district = await pending
      if (!district) return
      await db.visitorSession.updateMany({ where: { id: sessionId }, data: { district } })
      await db.visitor.updateMany({ where: { id: visitorId }, data: { district } })
    } catch (err) {
      console.warn(
        "[VISITORS] district lookup failed",
        pincode,
        err instanceof Error ? err.message : err,
      )
    }
  })
}
