import { RateLimitError } from "@/lib/errors"

/**
 * In-memory fixed-window limiter. Enough for a single instance; swap the Map
 * for Redis before running more than one (§6, rate-limit every public
 * endpoint).
 */
type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

export function rateLimit(key: string, limit: number, windowMs: number): void {
  const now = Date.now()
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

/** Housekeeping so the Map cannot grow without bound. */
export function sweepRateLimits(): void {
  const now = Date.now()
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
}
