import { beforeEach, describe, expect, it, vi } from "vitest"

import { PERMISSION_DEFINITIONS } from "@/lib/constants"
import {
  ensureCatalogue,
  ensureFirstAdmin,
  grantAllToFullAccessRoles,
  isLocalDatabase,
} from "@/prisma/setup"
import type { Db } from "@/server/db"

/**
 * Setting a database up only ever adds: no existing password is replaced,
 * no stock or price touched, and the destructive seed knows which databases
 * are this machine's.
 */

vi.mock("@/lib/crypto", () => ({ hashPassword: async (p: string) => `hashed:${p}` }))

const db = {
  user: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
  userRole: { upsert: vi.fn() },
  role: { findMany: vi.fn() },
  permission: { findMany: vi.fn() },
  rolePermission: { createMany: vi.fn() },
  product: { upsert: vi.fn() },
  variant: { findUnique: vi.fn(), create: vi.fn() },
  mediaAsset: { createMany: vi.fn() },
}
const asDb = db as unknown as Db

beforeEach(() => {
  vi.clearAllMocks()
  db.user.create.mockResolvedValue({ id: "new-admin" })
  db.product.upsert.mockResolvedValue({ id: "product-1" })
  db.variant.create.mockResolvedValue({ id: "variant-new" })
})

describe("isLocalDatabase", () => {
  it("knows this machine from a hosted database", () => {
    expect(isLocalDatabase("postgresql://u:p@localhost:5432/skelmet")).toBe(true)
    expect(isLocalDatabase("postgresql://u:p@127.0.0.1/skelmet?schema=public")).toBe(true)
    expect(isLocalDatabase("postgresql://u:p@db.skelmet.in:5432/skelmet")).toBe(false)
    expect(isLocalDatabase("postgresql://u:p@localhost.evil.example/x")).toBe(false)
    expect(isLocalDatabase(undefined)).toBe(false)
    expect(isLocalDatabase("not a url")).toBe(false)
  })
})

describe("ensureFirstAdmin", () => {
  it("creates the first admin, who must change the password", async () => {
    db.user.findUnique.mockResolvedValue(null)
    expect(
      await ensureFirstAdmin(asDb, {
        email: "Owner@Skelmet.in",
        password: "temp-1234",
        roleId: "r",
      }),
    ).toBe("created")
    expect(db.user.create).toHaveBeenCalledWith({
      data: {
        email: "owner@skelmet.in",
        name: "Console Admin",
        kind: "STAFF",
        passwordHash: "hashed:temp-1234",
        mustChangePassword: true,
      },
      select: { id: true },
    })
  })

  it("never replaces an existing member of staff's password", async () => {
    db.user.findUnique.mockResolvedValue({ id: "owner", kind: "STAFF" })
    expect(
      await ensureFirstAdmin(asDb, { email: "owner@skelmet.in", password: "temp", roleId: "r" }),
    ).toBe("kept")
    expect(db.user.update).not.toHaveBeenCalled()
    expect(db.userRole.upsert).toHaveBeenCalled()
  })

  it("needs a password only when the account has to be made", async () => {
    db.user.findUnique.mockResolvedValue(null)
    expect(
      await ensureFirstAdmin(asDb, { email: "owner@skelmet.in", password: undefined, roleId: "r" }),
    ).toBe("no-password")
    expect(db.user.create).not.toHaveBeenCalled()
  })
})

describe("grantAllToFullAccessRoles", () => {
  it("gives every permission to Admin and Owner, adding only what is missing", async () => {
    db.role.findMany.mockResolvedValue([{ id: "admin" }, { id: "owner" }])
    db.permission.findMany.mockResolvedValue(
      PERMISSION_DEFINITIONS.map((_, i) => ({ id: `p${i}` })),
    )
    db.rolePermission.createMany.mockResolvedValue({ count: 3 })

    expect(await grantAllToFullAccessRoles(asDb)).toBe(3)
    const { data, skipDuplicates } = db.rolePermission.createMany.mock.calls[0]![0]
    expect(skipDuplicates).toBe(true)
    expect(data).toHaveLength(PERMISSION_DEFINITIONS.length * 2)
  })
})

describe("ensureCatalogue", () => {
  it("adds missing variants only, leaving existing stock and prices alone", async () => {
    db.variant.findUnique.mockResolvedValueOnce({ id: "exists" }).mockResolvedValue(null)
    const { variantsCreated } = await ensureCatalogue(asDb, { stock: 0 })
    expect(db.product.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: {} }))
    expect(variantsCreated).toBeGreaterThan(0)
    for (const [call] of db.variant.create.mock.calls) expect(call.data.stock).toBe(0)
  })

  it("adds every product, the Flame Skull live and a newer one as a draft", async () => {
    db.variant.findUnique.mockResolvedValue(null)
    await ensureCatalogue(asDb, { stock: 0 })
    const created = db.product.upsert.mock.calls.map(([call]) => call.create)
    expect(created).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ slug: "flame-skull-mount", status: "ACTIVE" }),
        expect.objectContaining({ slug: "piston-skull-mount", status: "DRAFT" }),
      ]),
    )
    const skus = db.variant.create.mock.calls.map(([call]) => call.data.sku)
    expect(skus).toEqual(expect.arrayContaining(["SKM-BLZ", "SKM-PST-BLZ", "SKM-PST-GHT"]))
  })
})
