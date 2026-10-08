import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  hasDatabase: vi.fn(() => true),
}))

vi.mock("@/server/db", () => ({ db: { user: { findUnique: mocks.findUnique } } }))
vi.mock("@/lib/env", () => ({ hasDatabase: mocks.hasDatabase }))

const { SESSION_ABSOLUTE_MS, outlived, tokenStillValid } = await import("@/server/session-policy")

const NOW = Date.UTC(2026, 8, 29, 12)
const token = (over: Record<string, unknown> = {}) => ({
  id: "user-1",
  sessionVersion: 3,
  loginAt: NOW - 60_000,
  ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
  mocks.hasDatabase.mockReturnValue(true)
  mocks.findUnique.mockResolvedValue({ kind: "STAFF", sessionVersion: 3 })
})

describe("outlived", () => {
  it("ends a session thirty days after sign-in, however active", () => {
    expect(SESSION_ABSOLUTE_MS).toBe(30 * 24 * 60 * 60_000)
    expect(outlived(NOW - SESSION_ABSOLUTE_MS + 1_000, NOW)).toBe(false)
    expect(outlived(NOW - SESSION_ABSOLUTE_MS - 1_000, NOW)).toBe(true)
  })

  it("ends tokens with no sign-in time, or one from the future", () => {
    expect(outlived(null, NOW)).toBe(true)
    expect(outlived(NOW + 60 * 60_000, NOW)).toBe(true)
  })
})

describe("tokenStillValid", () => {
  it("keeps a token whose version matches the user's row", async () => {
    expect(await tokenStillValid(token(), NOW)).toBe(true)
    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: { id: "user-1" },
      select: { kind: true, sessionVersion: true },
    })
  })

  it("ends it once the row's version has been bumped", async () => {
    mocks.findUnique.mockResolvedValue({ kind: "STAFF", sessionVersion: 4 })
    expect(await tokenStillValid(token(), NOW)).toBe(false)
  })

  it("ends it for someone no longer staff, or no longer there", async () => {
    mocks.findUnique.mockResolvedValue({ kind: "CUSTOMER", sessionVersion: 3 })
    expect(await tokenStillValid(token(), NOW)).toBe(false)
    mocks.findUnique.mockResolvedValue(null)
    expect(await tokenStillValid(token(), NOW)).toBe(false)
  })

  it("ends a token minted before versions existed, without asking the database", async () => {
    expect(await tokenStillValid({ id: "user-1", loginAt: NOW }, NOW)).toBe(false)
    expect(await tokenStillValid({ id: "user-1", sessionVersion: 0 }, NOW)).toBe(false)
    expect(mocks.findUnique).not.toHaveBeenCalled()
  })

  it("keeps the session through a database blip - the guards fail closed instead", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    mocks.findUnique.mockRejectedValue(new Error("connection reset"))
    expect(await tokenStillValid(token(), NOW)).toBe(true)
  })
})
