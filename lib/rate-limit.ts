import { RateLimitError } from "@/lib/errors"

// In-memory fixed window: one instance only; move to Redis before running more.
type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

// Swept from the write path, at most once a second, not on a timer (an
// interval keeps a serverless instance alive).
const SWEEP_ABOVE = 5_000
const SWEEP_EVERY_MS = 1_000
let lastSweep = 0

/** Hard ceiling against a flood of keys in one window: past it, the oldest bucket goes. */
export const MAX_BUCKETS = 10_000

export function rateLimit(key: string, limit: number, windowMs: number): void {
  const now = Date.now()

  if (buckets.size > SWEEP_ABOVE && now - lastSweep >= SWEEP_EVERY_MS) {
    lastSweep = now
    sweepRateLimits(now)
  }

  const bucket = buckets.get(key)

  if (!bucket || bucket.resetAt <= now) {
    // Delete first so the Map's insertion order keeps the oldest key first.
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
 * Security: X-Real-IP is set by nginx, so a client cannot choose it. Never read
 * X-Forwarded-For: the client writes its first entry, which would reset every
 * limit. CF-Connecting-IP is a fallback for dev or no nginx.
 */
export function trustedClientIp(headers: Headers): string | null {
  const read = (name: string) => headers.get(name)?.trim().slice(0, 100) || null
  return read("x-real-ip") ?? read("cf-connecting-ip")
}

/** For rate-limit keys. */
export function clientIp(headers: Headers): string {
  return trustedClientIp(headers) ?? "unknown"
}

export function sweepRateLimits(now: number = Date.now()): void {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
}

/** For tests. */
export function rateLimitBucketCount(): number {
  return buckets.size
}
