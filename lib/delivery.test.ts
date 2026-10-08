import { describe, expect, it } from "vitest"

import { deliveryEta, formatEta } from "@/lib/delivery"

const day = (d: Date) => d.toISOString().slice(0, 10)

describe("deliveryEta", () => {
  it("adds two working days to dispatch and seven to deliver", () => {
    // Monday 28 Sep 2026, 10:00 in India.
    expect(day(deliveryEta("2026-09-28T04:30:00Z"))).toBe("2026-10-09")
  })

  it("skips weekends in both parts", () => {
    // Friday 2 Oct 2026, 23:00 in India.
    expect(day(deliveryEta("2026-10-02T17:30:00Z"))).toBe("2026-10-15")
    // Saturday and Sunday orders start counting on Monday, like a Friday one.
    expect(day(deliveryEta("2026-10-03T06:00:00Z"))).toBe("2026-10-15")
    expect(day(deliveryEta("2026-10-04T06:00:00Z"))).toBe("2026-10-15")
  })

  it("counts from India's date, not UTC's", () => {
    // 02:00 on Friday in India is still Thursday in UTC.
    expect(day(deliveryEta("2026-10-01T20:30:00Z"))).toBe("2026-10-15")
    // 20:00 on Thursday in India.
    expect(day(deliveryEta("2026-10-01T14:30:00Z"))).toBe("2026-10-14")
  })

  it("never lands on a weekend", () => {
    for (let h = 0; h < 24 * 14; h += 5) {
      const eta = deliveryEta(new Date(Date.UTC(2026, 8, 28) + h * 3_600_000).toISOString())
      expect([0, 6]).not.toContain(eta.getUTCDay())
    }
  })
})

describe("formatEta", () => {
  it("prints the day it should arrive by", () => {
    const text = formatEta("2026-09-28T04:30:00Z")
    expect(text).toMatch(/FRI/)
    expect(text).toMatch(/\b9\b/)
    expect(text).toMatch(/OCT/)
  })
})
