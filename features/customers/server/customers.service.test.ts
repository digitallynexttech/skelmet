import { beforeEach, describe, expect, it, vi } from "vitest"

// Checking out with someone else's email must not rewrite their saved details.

const mocks = vi.hoisted(() => {
  const tx = {
    user: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    address: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
  }
  return {
    tx,
    db: {
      order: { findUnique: vi.fn() },
      user: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn() },
      $transaction: vi.fn(async (work: (t: typeof tx) => unknown) => work(tx)),
    },
  }
})

vi.mock("@/server/db", () => ({ db: mocks.db }))
vi.mock("@/lib/env", () => ({ hasDatabase: () => true }))
vi.mock("@/server/action-guard", () => ({ requirePermission: async () => ({ user: { id: "a" } }) }))

const { attachCustomer, listCustomers, rememberCustomerDetails } =
  await import("@/features/customers/server/customers.service")

const PAID_ORDER = {
  email: "Rider@Example.in",
  phone: "9876543210",
  shippingAddress: {
    firstName: "Asha",
    lastName: "Rao",
    line1: "12 MG Road",
    line2: "",
    city: "Jaipur",
    state: "Rajasthan",
    pincode: "302001",
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.db.$transaction.mockImplementation(async (work) => work(mocks.tx))
})

describe("attachCustomer, at placement", () => {
  it("writes nothing to someone who already exists", async () => {
    mocks.tx.user.findUnique.mockResolvedValue({ id: "existing" })
    expect(await attachCustomer(mocks.tx as never, { email: "Rider@Example.in" })).toBe("existing")
    expect(mocks.tx.user.update).not.toHaveBeenCalled()
    expect(mocks.tx.address.update).not.toHaveBeenCalled()
    expect(mocks.tx.address.create).not.toHaveBeenCalled()
  })

  it("creates a bare customer for a new email", async () => {
    mocks.tx.user.findUnique.mockResolvedValue(null)
    mocks.tx.user.create.mockResolvedValue({ id: "new" })
    expect(await attachCustomer(mocks.tx as never, { email: "New@Example.in" })).toBe("new")
    expect(mocks.tx.user.create).toHaveBeenCalledWith({
      data: { email: "new@example.in", kind: "CUSTOMER" },
      select: { id: true },
    })
  })
})

describe("rememberCustomerDetails, once paid", () => {
  it("saves the order's address, filling the name and phone only where blank", async () => {
    mocks.db.order.findUnique.mockResolvedValue(PAID_ORDER)
    mocks.db.user.findUnique.mockResolvedValue({
      id: "cust-1",
      kind: "CUSTOMER",
      name: "Asha R",
      phone: null,
    })
    mocks.tx.address.findFirst.mockResolvedValue({ id: "addr-1" })

    await rememberCustomerDetails("order-1")

    expect(mocks.db.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: "rider@example.in" } }),
    )
    expect(mocks.tx.user.update).toHaveBeenCalledWith({
      where: { id: "cust-1" },
      data: { name: "Asha R", phone: "9876543210" },
      select: { id: true },
    })
    expect(mocks.tx.address.update).toHaveBeenCalledWith({
      where: { id: "addr-1" },
      data: expect.objectContaining({ line1: "12 MG Road", pincode: "302001", line2: null }),
    })
  })

  it("leaves a member of staff's details alone", async () => {
    mocks.db.order.findUnique.mockResolvedValue(PAID_ORDER)
    mocks.db.user.findUnique.mockResolvedValue({ id: "s", kind: "STAFF", name: null, phone: null })
    await rememberCustomerDetails("order-1")
    expect(mocks.db.$transaction).not.toHaveBeenCalled()
  })

  it("never throws into the payment it follows", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    mocks.db.order.findUnique.mockRejectedValue(new Error("db down"))
    await expect(rememberCustomerDetails("order-1")).resolves.toBeUndefined()
  })
})

describe("listCustomers", () => {
  it("takes the table's whole window, and survives a garbage page size", async () => {
    mocks.db.user.findMany.mockResolvedValue([])
    mocks.db.user.count.mockResolvedValue(0)

    await listCustomers({ page: 1, pageSize: 200 })
    expect(mocks.db.user.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ take: 200 }))

    await listCustomers({ page: Number.NaN, pageSize: Number.NaN })
    expect(mocks.db.user.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ take: 20, skip: 0 }),
    )
  })
})
