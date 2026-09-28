import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * The guards every console service calls. Access is read from the database
 * on every action, so a reset password, a revoke or a temporary password
 * takes effect at once rather than when the token expires.
 */

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findUnique: vi.fn(),
}))

vi.mock("@/server/auth", () => ({ auth: mocks.auth }))
vi.mock("@/server/db", () => ({ db: { user: { findUnique: mocks.findUnique } } }))
vi.mock("@/lib/env", () => ({ hasDatabase: () => true }))

const { MUST_CHANGE_PASSWORD, requirePermission, requireStaff, staffSession } =
  await import("@/server/action-guard")

const session = (over: Record<string, unknown> = {}) => ({
  user: {
    id: "user-1",
    kind: "STAFF",
    roles: [],
    permissions: [],
    mustChangePassword: false,
    sessionVersion: 1,
    loginAt: Date.now() - 60_000,
    ...over,
  },
  expires: "",
})

const row = (over: Record<string, unknown> = {}) => ({
  kind: "STAFF",
  sessionVersion: 1,
  mustChangePassword: false,
  roles: [{ role: { name: "Admin", permissions: [{ permission: { scope: "order:read" } }] } }],
  ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
  mocks.auth.mockResolvedValue(session())
  mocks.findUnique.mockResolvedValue(row())
})

describe("requirePermission", () => {
  it("passes with the permissions read from the database", async () => {
    const s = await requirePermission("order:read")
    expect(s.user.permissions).toEqual(["order:read"])
  })

  it("answers 401 once the session version has moved on", async () => {
    mocks.findUnique.mockResolvedValue(row({ sessionVersion: 2 }))
    await expect(requirePermission("order:read")).rejects.toMatchObject({ status: 401 })
  })

  it("answers 401 for a token with no version or past its lifetime", async () => {
    mocks.auth.mockResolvedValue(session({ sessionVersion: undefined }))
    await expect(requirePermission("order:read")).rejects.toMatchObject({ status: 401 })
    mocks.auth.mockResolvedValue(session({ loginAt: Date.now() - 31 * 24 * 60 * 60_000 }))
    await expect(requirePermission("order:read")).rejects.toMatchObject({ status: 401 })
  })

  it("refuses everything while the password is temporary, from the database not the token", async () => {
    mocks.findUnique.mockResolvedValue(row({ mustChangePassword: true }))
    await expect(requirePermission("order:read")).rejects.toMatchObject({
      status: 403,
      message: MUST_CHANGE_PASSWORD,
    })
  })

  it("lets a temporary password be changed", async () => {
    mocks.findUnique.mockResolvedValue(row({ mustChangePassword: true }))
    const s = await requireStaff({ allowPendingPasswordChange: true })
    expect(s.user.mustChangePassword).toBe(true)
  })

  it("does not let a revoked member of staff through", async () => {
    mocks.findUnique.mockResolvedValue(row({ kind: "CUSTOMER" }))
    await expect(requireStaff()).rejects.toMatchObject({ status: 403 })
  })
})

describe("staffSession", () => {
  it("hands the layout the live flag, so it can send them to change it", async () => {
    mocks.findUnique.mockResolvedValue(row({ mustChangePassword: true }))
    expect((await staffSession())?.user.mustChangePassword).toBe(true)
  })

  it("is null for a session that has ended", async () => {
    mocks.findUnique.mockResolvedValue(row({ sessionVersion: 9 }))
    expect(await staffSession()).toBeNull()
  })
})
