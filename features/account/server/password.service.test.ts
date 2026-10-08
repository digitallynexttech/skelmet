import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  requireStaff: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
  verifyPassword: vi.fn(),
}))

vi.mock("@/server/action-guard", () => ({ requireStaff: mocks.requireStaff }))
vi.mock("@/server/db", () => ({
  db: { user: { findUnique: mocks.findUnique, update: mocks.update } },
}))
vi.mock("@/server/audit", () => ({
  createAuditLog: vi.fn(),
  getAuditMeta: async () => ({ ip: "x", userAgent: "y" }),
}))
vi.mock("@/lib/env", () => ({ hasDatabase: () => true }))
vi.mock("@/lib/crypto", () => ({
  hashPassword: async (p: string) => `hashed:${p}`,
  verifyPassword: mocks.verifyPassword,
}))

const { changeOwnPassword } = await import("@/features/account/server/password.service")

const body = {
  currentPassword: "old-password-1",
  newPassword: "new-password-22",
  confirmPassword: "new-password-22",
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireStaff.mockResolvedValue({ user: { id: "user-1" } })
  mocks.findUnique.mockResolvedValue({ id: "user-1", passwordHash: "stored" })
  mocks.verifyPassword.mockResolvedValue(true)
})

describe("changeOwnPassword", () => {
  it("is allowed while the password is temporary - it is the way out", async () => {
    await changeOwnPassword(body)
    expect(mocks.requireStaff).toHaveBeenCalledWith({ allowPendingPasswordChange: true })
  })

  it("clears the flag and ends every other session", async () => {
    expect(await changeOwnPassword(body)).toEqual({ ok: true, data: { ok: true } })
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: {
        passwordHash: "hashed:new-password-22",
        mustChangePassword: false,
        sessionVersion: { increment: 1 },
      },
      select: { id: true },
    })
  })

  it("refuses without the current password", async () => {
    mocks.verifyPassword.mockResolvedValue(false)
    expect(await changeOwnPassword(body)).toMatchObject({ ok: false, status: 422 })
    expect(mocks.update).not.toHaveBeenCalled()
  })
})
