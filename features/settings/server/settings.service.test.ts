import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Staff management: what revoking and resetting actually take away, and the
 * rule that the console always keeps someone who can administer it.
 */

const mocks = vi.hoisted(() => {
  const tx = {
    $queryRaw: vi.fn(),
    user: {
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    userRole: { deleteMany: vi.fn(), createMany: vi.fn(), findMany: vi.fn() },
  }
  return {
    tx,
    session: { user: { id: "admin-1", permissions: ["setting:write"] } },
    db: {
      $transaction: vi.fn(async (work: (t: typeof tx) => unknown) => work(tx)),
      user: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
      role: { findMany: vi.fn() },
    },
    createAuditLog: vi.fn(),
  }
})

vi.mock("@/server/db", () => ({ db: mocks.db }))
vi.mock("@/server/action-guard", () => ({ requirePermission: async () => mocks.session }))
vi.mock("@/server/audit", () => ({
  createAuditLog: mocks.createAuditLog,
  getAuditMeta: async () => ({ ip: "x", userAgent: "y" }),
}))
vi.mock("@/lib/env", () => ({ hasDatabase: () => true }))
vi.mock("@/lib/crypto", () => ({ hashPassword: async (p: string) => `hashed:${p}` }))

const service = await import("@/features/settings/server/settings.service")

const STAFF_ROW = {
  id: "staff-2",
  name: "Packer",
  email: "packer@skelmet.in",
  mustChangePassword: true,
  createdAt: new Date("2026-09-01"),
  roles: [{ role: { id: "role-a", name: "Admin" } }],
}

const ROLE = "7a0c7f5e-1b2c-4d3e-8f90-a1b2c3d4e5f6"

beforeEach(() => {
  vi.clearAllMocks()
  mocks.db.$transaction.mockImplementation(async (work) => work(mocks.tx))
  mocks.tx.user.count.mockResolvedValue(1)
  mocks.tx.user.findUniqueOrThrow.mockResolvedValue(STAFF_ROW)
  mocks.tx.userRole.findMany.mockResolvedValue([])
  mocks.tx.user.updateMany.mockResolvedValue({ count: 1 })
  mocks.db.user.findUnique.mockResolvedValue({ id: "staff-2", kind: "STAFF", email: "x@y.in" })
  mocks.db.user.update.mockResolvedValue(STAFF_ROW)
  mocks.db.role.findMany.mockResolvedValue([{ id: ROLE }])
})

describe("revokeStaff", () => {
  it("drops the password and ends their sessions, not only the kind", async () => {
    expect(await service.revokeStaff("staff-2")).toEqual({ ok: true, data: { id: "staff-2" } })
    expect(mocks.tx.user.update).toHaveBeenCalledWith({
      where: { id: "staff-2" },
      data: {
        kind: "CUSTOMER",
        passwordHash: null,
        mustChangePassword: false,
        sessionVersion: { increment: 1 },
      },
      select: { id: true },
    })
  })

  it("takes the lock before changing anything, and rolls back if no admin would be left", async () => {
    mocks.tx.user.count.mockResolvedValue(0)
    const result = await service.revokeStaff("staff-2")
    expect(result).toMatchObject({ ok: false, status: 409 })
    expect(mocks.tx.$queryRaw).toHaveBeenCalled()
    expect(mocks.createAuditLog).not.toHaveBeenCalled()
  })
})

describe("setStaffRoles", () => {
  it("ends the sessions of someone who lost a role", async () => {
    mocks.tx.userRole.findMany.mockResolvedValue([{ roleId: "old-role" }])
    await service.setStaffRoles("staff-2", { roleIds: [ROLE] })
    expect(mocks.tx.user.update).toHaveBeenCalledWith({
      where: { id: "staff-2" },
      data: { sessionVersion: { increment: 1 } },
      select: { id: true },
    })
  })

  it("refuses a change that leaves nobody able to administer", async () => {
    mocks.tx.user.count.mockResolvedValue(0)
    expect(await service.setStaffRoles("staff-2", { roleIds: [] })).toMatchObject({
      ok: false,
      status: 409,
    })
  })
})

describe("resetStaffPassword", () => {
  it("refuses your own account", async () => {
    const result = await service.resetStaffPassword("admin-1", { password: "0123456789" })
    expect(result).toMatchObject({ ok: false, status: 409 })
    expect(mocks.db.user.update).not.toHaveBeenCalled()
  })

  it("sets a temporary password and ends their sessions", async () => {
    await service.resetStaffPassword("staff-2", { password: "0123456789" })
    expect(mocks.db.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          passwordHash: "hashed:0123456789",
          mustChangePassword: true,
          sessionVersion: { increment: 1 },
        },
      }),
    )
  })
})

describe("createStaff", () => {
  const input = {
    name: "Packer",
    email: "Packer@Skelmet.in",
    password: "0123456789",
    roleIds: [ROLE],
  }

  it("promotes a customer row with that email instead of refusing", async () => {
    mocks.db.user.findUnique.mockResolvedValue({ id: "cust-1", kind: "CUSTOMER" })
    const result = await service.createStaff(input)
    expect(result.ok).toBe(true)
    expect(mocks.tx.user.updateMany).toHaveBeenCalledWith({
      where: { id: "cust-1", kind: "CUSTOMER" },
      data: expect.objectContaining({
        kind: "STAFF",
        passwordHash: "hashed:0123456789",
        mustChangePassword: true,
      }),
    })
    expect(mocks.db.user.create).not.toHaveBeenCalled()
  })

  it("still refuses an address that is already staff", async () => {
    mocks.db.user.findUnique.mockResolvedValue({ id: "staff-9", kind: "STAFF" })
    expect(await service.createStaff(input)).toMatchObject({ ok: false, status: 409 })
  })
})
