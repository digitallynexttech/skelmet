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
 * until there is something to collect.
 *
 * Every key is an IP, so the ceiling is really a question of how many distinct
 * clients arrive inside one window. A few thousand buckets is a few hundred KB.
 */
const SWEEP_ABOVE = 5_000

export function rateLimit(key: string, limit: number, windowMs: number): void {
  const now = Date.now()

  // Without this the map only ever grows: a bucket is written on the first
  // request from an IP and, once its window lapses, is overwritten but never
  // removed for an IP that does not come back.
  if (buckets.size > SWEEP_ABOVE) sweepRateLimits(now)

  const bucket = buckets.get(key)

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return
  }

  if (bucket.count >= limit) {
    throw new RateLimitError()
  }

  bucket.count += 1
}

/** Best-effort client IP from the proxy headers Next exposes. */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? "unknown"
  return headers.get("x-real-ip") ?? "unknown"
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
