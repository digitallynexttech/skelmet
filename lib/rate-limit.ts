import { RateLimitError } from "@/lib/errors"

/**
 * In-memory fixed-window limiter. Enough for a single instance; swap the Map
 * for Redis before running more than one (§6, rate-limit every public
 * endpoint).
 */
type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

/**
 * Sweep when the map gets big, rather than on a timer.
 *
 * A `setInterval` would hold a reference for the life of the process, which
 * keeps a serverless instance from idling out, and on a cold one it would
 * never get the chance to run. Sweeping from the write path costs nothing
 * until there is something to collect - and at most once a second, so a full
 * map of live buckets is not walked on every request.
 */
const SWEEP_ABOVE = 5_000
const SWEEP_EVERY_MS = 1_000
let lastSweep = 0

/**
 * The hard ceiling. Sweeping only drops buckets whose window has closed, so a
 * flood of distinct keys inside one window grew the map without bound. Past
 * this many, the oldest bucket goes: at worst that client's window starts
 * over, which costs far less than the process running out of memory.
 */
export const MAX_BUCKETS = 10_000

export function rateLimit(key: string, limit: number, windowMs: number): void {
  const now = Date.now()

  // Without this the map only ever grows: a bucket is written on the first
  // request from an IP and, once its window lapses, is overwritten but never
  // removed for an IP that does not come back.
  if (buckets.size > SWEEP_ABOVE && now - lastSweep >= SWEEP_EVERY_MS) {
    lastSweep = now
    sweepRateLimits(now)
  }

  const bucket = buckets.get(key)

  if (!bucket || bucket.resetAt <= now) {
    // Deleted first so the fresh window goes to the back of the Map's
    // insertion order, which is what makes the first key the oldest.
    buckets.delete(key)
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    while (buckets.size > MAX_BUCKETS) {
      const oldest = buckets.keys().next().value
      if (oldest === undefined) break
      buckets.delete(oldest)
    }
    return
  }

  if (bucket.count >= limit) {
    throw new RateLimitError()
  }

  bucket.count += 1
}

/**
 * The client's address, from the one header this deployment can vouch for.
 *
 * The site runs Cloudflare -> nginx -> `next start`. nginx sets X-Real-IP
 * itself (with `real_ip_header CF-Connecting-IP`, the visitor's own address),
 * so a browser cannot choose it. X-Forwarded-For is NEVER read: its first
 * entry is whatever the client sent, and trusting it let anyone reset every
 * limit in the shop by sending a new made-up address with each request.
 *
 * CF-Connecting-IP is only a fallback for when X-Real-IP is absent - local
 * development, or a direct request with no nginx in front.
 */
export function trustedClientIp(headers: Headers): string | null {
  const read = (name: string) => headers.get(name)?.trim().slice(0, 100) || null
  return read("x-real-ip") ?? read("cf-connecting-ip")
}

/** The trusted client address, or "unknown" - for rate-limit keys. */
export function clientIp(headers: Headers): string {
  return trustedClientIp(headers) ?? "unknown"
}

/** Drops every bucket whose window has already closed. */
export function sweepRateLimits(now: number = Date.now()): void {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
}

/** Exposed for tests: how many buckets are currently held. */
export function rateLimitBucketCount(): number {
  return buckets.size
}
