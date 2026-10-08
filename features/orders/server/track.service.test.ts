import { beforeEach, describe, expect, it, vi } from "vitest"

const findUnique = vi.fn()
vi.mock("@/server/db", () => ({ db: { order: { findUnique } } }))
vi.mock("@/lib/env", () => ({ hasDatabase: () => true }))

async function load() {
  vi.resetModules()
  return import("@/features/orders/server/track.service")
}

beforeEach(() => {
  findUnique.mockReset()
  findUnique.mockResolvedValue(null)
})

describe("trackOrder", () => {
  it("stops answering for one email after ten tries, whatever the order number", async () => {
    const { trackOrder } = await load()
    for (let i = 0; i < 10; i++) {
      const miss = await trackOrder({ orderNumber: `SKM-2026-AAA${i}`, email: "rider@example.in" })
      expect(miss).toMatchObject({ ok: false, status: 404 })
    }
    expect(
      await trackOrder({ orderNumber: "SKM-2026-BBBB", email: "RIDER@example.in" }),
    ).toMatchObject({ ok: false, status: 429 })
    expect(findUnique).toHaveBeenCalledTimes(10)

    // Another email is its own budget.
    expect(
      await trackOrder({ orderNumber: "SKM-2026-BBBB", email: "other@example.in" }),
    ).toMatchObject({ ok: false, status: 404 })
  })
})
