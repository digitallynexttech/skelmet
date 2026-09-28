import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * The limiter is only as good as the key it is given. These pin down that
 * the key is an address the client cannot choose, and that the map cannot be
 * grown without bound by a flood of new keys.
 */

async function limiter() {
  vi.resetModules()
  return import("@/lib/rate-limit")
}

beforeEach(() => {
  vi.useRealTimers()
})

describe("trustedClientIp", () => {
  it("takes X-Real-IP, which nginx sets", async () => {
    const { trustedClientIp } = await limiter()
    const h = new Headers({ "x-real-ip": "198.51.100.7", "cf-connecting-ip": "203.0.113.1" })
    expect(trustedClientIp(h)).toBe("198.51.100.7")
  })

  it("never reads the first X-Forwarded-For entry, which the client writes", async () => {
    const { clientIp, trustedClientIp } = await limiter()
    const h = new Headers({
      "x-forwarded-for": "1.2.3.4, 198.51.100.7",
      "x-real-ip": "198.51.100.7",
    })
    expect(trustedClientIp(h)).toBe("198.51.100.7")
    expect(clientIp(new Headers({ "x-forwarded-for": "1.2.3.4" }))).toBe("unknown")
  })

  it("falls back to CF-Connecting-IP only when X-Real-IP is absent", async () => {
    const { trustedClientIp } = await limiter()
    expect(trustedClientIp(new Headers({ "cf-connecting-ip": "203.0.113.1" }))).toBe("203.0.113.1")
    expect(trustedClientIp(new Headers({ "x-real-ip": "  " }))).toBeNull()
  })
})

describe("rateLimit", () => {
  it("allows up to the limit, then refuses with a 429", async () => {
    const { rateLimit } = await limiter()
    for (let i = 0; i < 3; i++) rateLimit("k", 3, 60_000)
    expect(() => rateLimit("k", 3, 60_000)).toThrow(expect.objectContaining({ status: 429 }))
  })

  it("starts a fresh window once the old one closes", async () => {
    vi.useFakeTimers()
    const { rateLimit } = await limiter()
    rateLimit("k", 1, 1_000)
    expect(() => rateLimit("k", 1, 1_000)).toThrow()
    vi.advanceTimersByTime(1_001)
    expect(() => rateLimit("k", 1, 1_000)).not.toThrow()
  })

  it("never holds more than MAX_BUCKETS, evicting the oldest", async () => {
    const { MAX_BUCKETS, rateLimit, rateLimitBucketCount } = await limiter()
    for (let i = 0; i < MAX_BUCKETS + 250; i++) rateLimit(`flood:${i}`, 1, 60_000)
    expect(rateLimitBucketCount()).toBe(MAX_BUCKETS)
    // The first key was evicted, so it has a fresh window; the newest has not.
    expect(() => rateLimit("flood:0", 1, 60_000)).not.toThrow()
    expect(() => rateLimit(`flood:${MAX_BUCKETS + 249}`, 1, 60_000)).toThrow()
  })
})
