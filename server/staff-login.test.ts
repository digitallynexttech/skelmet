import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  verifyPassword: vi.fn(),
  verifyPasswordOfNobody: vi.fn(),
  needsRehash: vi.fn(),
  hashPassword: vi.fn(),
}))

vi.mock("@/server/db", () => ({
  db: { user: { findUnique: mocks.findUnique, update: mocks.update } },
}))
vi.mock("@/lib/crypto", () => ({
  verifyPassword: mocks.verifyPassword,
  verifyPasswordOfNobody: mocks.verifyPasswordOfNobody,
  needsRehash: mocks.needsRehash,
  hashPassword: mocks.hashPassword,
}))

async function load() {
  vi.resetModules()
  return import("@/server/staff-login")
}

const STAFF = {
  id: "user-1",
  email: "owner@skelmet.in",
  name: "Owner",
  kind: "STAFF",
  passwordHash: "scrypt$17$8$1$aa$bb",
  mustChangePassword: false,
  sessionVersion: 2,
  roles: [
    {
      role: {
        name: "Admin",
        permissions: [
          { permission: { scope: "order:read" } },
          { permission: { scope: "setting:write" } },
        ],
      },
    },
  ],
}

let ip = 0
// A fresh IP per call, so tests do not share rate limits.
const from = () => new Headers({ "x-real-ip": `198.51.100.${++ip}` })

beforeEach(() => {
  vi.clearAllMocks()
  mocks.findUnique.mockResolvedValue(STAFF)
  mocks.verifyPassword.mockResolvedValue(true)
  mocks.verifyPasswordOfNobody.mockResolvedValue(false)
  mocks.needsRehash.mockReturnValue(false)
})

describe("authorizeStaff", () => {
  it("signs in a member of staff, carrying their session version", async () => {
    const { authorizeStaff } = await load()
    const user = await authorizeStaff({ email: " Owner@Skelmet.in ", password: "pw" }, from())
    expect(user).toMatchObject({
      id: "user-1",
      kind: "STAFF",
      roles: ["Admin"],
      permissions: ["order:read", "setting:write"],
      sessionVersion: 2,
    })
    expect(mocks.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: "owner@skelmet.in" } }),
    )
  })

  it("refuses customers and unknown addresses, after the same scrypt work", async () => {
    const { authorizeStaff } = await load()
    mocks.findUnique.mockResolvedValueOnce({ ...STAFF, kind: "CUSTOMER" })
    expect(await authorizeStaff({ email: "a@b.in", password: "pw" }, from())).toBeNull()
    mocks.findUnique.mockResolvedValueOnce(null)
    expect(await authorizeStaff({ email: "c@d.in", password: "pw" }, from())).toBeNull()
    mocks.findUnique.mockResolvedValueOnce({ ...STAFF, passwordHash: null })
    expect(await authorizeStaff({ email: "e@f.in", password: "pw" }, from())).toBeNull()

    expect(mocks.verifyPasswordOfNobody).toHaveBeenCalledTimes(3)
    expect(mocks.verifyPassword).not.toHaveBeenCalled()
  })

  it("refuses a wrong password", async () => {
    const { authorizeStaff } = await load()
    mocks.verifyPassword.mockResolvedValue(false)
    expect(await authorizeStaff({ email: "owner@skelmet.in", password: "no" }, from())).toBeNull()
  })

  it("limits attempts on one account even from many addresses", async () => {
    const { authorizeStaff, LOGIN_LIMITS } = await load()
    mocks.verifyPassword.mockResolvedValue(false)
    for (let i = 0; i < LOGIN_LIMITS.perEmail.limit; i++) {
      await authorizeStaff({ email: "owner@skelmet.in", password: `guess${i}` }, from())
    }
    mocks.verifyPassword.mockResolvedValue(true)
    mocks.findUnique.mockClear()

    expect(
      await authorizeStaff({ email: "owner@skelmet.in", password: "right" }, from()),
    ).toBeNull()
    expect(mocks.findUnique).not.toHaveBeenCalled()
  })

  it("limits attempts from one address across accounts", async () => {
    const { authorizeStaff, LOGIN_LIMITS } = await load()
    const one = new Headers({ "x-real-ip": "203.0.113.50" })
    for (let i = 0; i < LOGIN_LIMITS.perIp.limit; i++) {
      await authorizeStaff({ email: `person${i}@skelmet.in`, password: "pw" }, one)
    }
    expect(await authorizeStaff({ email: "owner@skelmet.in", password: "pw" }, one)).toBeNull()
  })

  it("rewrites an old-format hash at the current cost after a good sign-in", async () => {
    const { authorizeStaff } = await load()
    mocks.needsRehash.mockReturnValue(true)
    mocks.hashPassword.mockResolvedValue("scrypt$17$8$1$new$hash")
    await authorizeStaff({ email: "owner@skelmet.in", password: "pw" }, from())
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { passwordHash: "scrypt$17$8$1$new$hash" },
      select: { id: true },
    })
  })
})
