import "server-only"

import type { Prisma } from "@prisma/client"

import type { AddressInput } from "@/features/checkout/schemas/checkout.schema"
import { MAX_PAGE_SIZE, PERMISSIONS } from "@/lib/constants"
import { hasDatabase } from "@/lib/env"
import { fail, ok, runAction, type ActionResult } from "@/server/action-result"
import { requirePermission } from "@/server/action-guard"
import { db } from "@/server/db"

// Customers are created only by checkout: no password, no roles, nothing to sign in with.

/**
 * Finds or creates the customer behind an order. Writes nothing to an existing row:
 * phone and address wait for payment (rememberCustomerDetails), or anyone could
 * overwrite another person's details by checking out with their email.
 * Runs inside the order transaction.
 */
export async function attachCustomer(
  tx: Prisma.TransactionClient,
  input: { email: string },
): Promise<string> {
  const email = input.email.toLowerCase()

  // Never write `kind` on an existing row: a matching email must not grant or drop STAFF.
  const existing = await tx.user.findUnique({ where: { email }, select: { id: true } })
  if (existing) return existing.id

  const created = await tx.user.create({
    data: { email, kind: "CUSTOMER" },
    select: { id: true },
  })
  return created.id
}

/**
 * Saves a paid order's name, phone and address onto its customer (never at placement).
 * Customers only; name and phone fill blanks only; one address, the latest paid order's.
 * Best effort: never fails the payment it follows.
 */
export async function rememberCustomerDetails(orderId: string): Promise<void> {
  try {
    const order = await db.order.findUnique({
      where: { id: orderId },
      select: { email: true, phone: true, shippingAddress: true },
    })
    if (!order) return
    const user = await db.user.findUnique({
      where: { email: order.email.toLowerCase() },
      select: { id: true, kind: true, name: true, phone: true },
    })
    if (!user || user.kind !== "CUSTOMER") return

    const a = (order.shippingAddress ?? {}) as Partial<Record<keyof AddressInput, string>>
    const name = `${a.firstName ?? ""} ${a.lastName ?? ""}`.trim()

    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { name: user.name ?? (name || null), phone: user.phone ?? order.phone },
        select: { id: true },
      })

      if (!a.line1 || !a.city || !a.state || !a.pincode) return
      const fields = {
        name,
        line1: a.line1,
        line2: a.line2 || null,
        city: a.city,
        state: a.state,
        pincode: a.pincode,
        phone: order.phone,
      }
      const current = await tx.address.findFirst({
        where: { userId: user.id, isDefault: true },
        select: { id: true },
      })
      if (current) await tx.address.update({ where: { id: current.id }, data: fields })
      else await tx.address.create({ data: { ...fields, userId: user.id, isDefault: true } })
    })
  } catch (err) {
    console.error("[CUSTOMERS] could not save details from a paid order", orderId, err)
  }
}

export type CustomerRow = {
  id: string
  email: string
  name: string | null
  phone: string | null
  orderCount: number
  totalSpent: string
  lastOrderAt: string | null
  city: string | null
  createdAt: string
}

/** Admin customer list: anyone with a paid order (unpaid ones are in Abandoned carts); no staff. */
export async function listCustomers(
  params: { page?: number; pageSize?: number; search?: string } = {},
): Promise<
  ActionResult<{
    data: CustomerRow[]
    pagination: { page: number; pageSize: number; total: number; totalPages: number }
  }>
> {
  return runAction(async () => {
    await requirePermission(PERMISSIONS.ORDER_READ)
    if (!hasDatabase()) return fail("Database not configured.", undefined, 503)

    // MAX_PAGE_SIZE, not 100: the table asks for its whole window and exports it.
    const page = Number.isFinite(params.page) ? Math.max(1, Math.trunc(params.page!)) : 1
    const pageSize = Number.isFinite(params.pageSize)
      ? Math.min(MAX_PAGE_SIZE, Math.max(1, Math.trunc(params.pageSize!)))
      : 20
    const search = params.search?.trim()

    const where: Prisma.UserWhereInput = {
      kind: "CUSTOMER",
      // Paid for, even if later refunded or returned: they bought.
      orders: { some: { status: { notIn: ["PENDING", "CANCELLED"] } } },
      ...(search
        ? {
            OR: [
              { email: { contains: search, mode: "insensitive" } },
              { name: { contains: search, mode: "insensitive" } },
              { phone: { contains: search } },
            ],
          }
        : {}),
    }

    const [rows, total] = await Promise.all([
      db.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          createdAt: true,
          addresses: { where: { isDefault: true }, select: { city: true }, take: 1 },
          orders: {
            // Spend counts only money the shop kept.
            where: { status: { notIn: ["PENDING", "CANCELLED", "REFUNDED"] } },
            select: { total: true, placedAt: true, createdAt: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.user.count({ where }),
    ])

    const data: CustomerRow[] = rows.map((u) => {
      const spent = u.orders.reduce((sum, o) => sum + Number(o.total), 0)
      const last = u.orders
        .map((o) => o.placedAt ?? o.createdAt)
        .sort((a, b) => b.getTime() - a.getTime())[0]
      return {
        id: u.id,
        email: u.email,
        name: u.name,
        phone: u.phone,
        orderCount: u.orders.length,
        // Money is a string on the wire.
        totalSpent: spent.toFixed(2),
        lastOrderAt: last ? last.toISOString() : null,
        city: u.addresses[0]?.city ?? null,
        createdAt: u.createdAt.toISOString(),
      }
    })

    return ok({
      data,
      pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    })
  })
}

export type CustomerAddress = {
  name: string
  line1: string
  line2: string | null
  city: string
  state: string
  pincode: string
  phone: string
}

export type CustomerOrder = {
  id: string
  number: string
  status: string
  paymentMethod: string
  total: string
  itemCount: number
  placedAt: string | null
  createdAt: string
}

export type CustomerDetail = {
  id: string
  email: string
  name: string | null
  phone: string | null
  createdAt: string
  address: CustomerAddress | null
  orders: CustomerOrder[]
  summary: {
    orderCount: number
    /** Excludes orders the shop did not keep the money for. */
    totalSpent: string
    averageOrder: string
    firstOrderAt: string | null
    lastOrderAt: string | null
  }
}

/** Orders that exist but are not money the shop kept. */
const NOT_REVENUE = new Set(["PENDING", "CANCELLED", "REFUNDED"])

/** One customer and their orders. ORDER_READ like the list; staff are excluded. */
export async function getCustomer(id: string): Promise<ActionResult<CustomerDetail>> {
  return runAction(async () => {
    await requirePermission(PERMISSIONS.ORDER_READ)
    if (!hasDatabase()) return fail("Database not configured.", undefined, 503)

    const user = await db.user.findFirst({
      where: { id, kind: "CUSTOMER" },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        createdAt: true,
        addresses: {
          where: { isDefault: true },
          select: {
            name: true,
            line1: true,
            line2: true,
            city: true,
            state: true,
            pincode: true,
            phone: true,
          },
          take: 1,
        },
        orders: {
          select: {
            id: true,
            number: true,
            status: true,
            paymentMethod: true,
            total: true,
            placedAt: true,
            createdAt: true,
            _count: { select: { items: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    })

    if (!user) return fail("No such customer.", undefined, 404)

    // Every order is listed; only kept money counts toward spend.
    const revenue = user.orders.filter((o) => !NOT_REVENUE.has(o.status))
    const spent = revenue.reduce((sum, o) => sum + Number(o.total), 0)
    const dates = user.orders
      .map((o) => o.placedAt ?? o.createdAt)
      .sort((a, b) => a.getTime() - b.getTime())

    return ok({
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      createdAt: user.createdAt.toISOString(),
      address: user.addresses[0] ?? null,
      orders: user.orders.map((o) => ({
        id: o.id,
        number: o.number,
        status: o.status,
        paymentMethod: o.paymentMethod,
        total: Number(o.total).toFixed(2),
        itemCount: o._count.items,
        placedAt: o.placedAt ? o.placedAt.toISOString() : null,
        createdAt: o.createdAt.toISOString(),
      })),
      summary: {
        orderCount: user.orders.length,
        totalSpent: spent.toFixed(2),
        averageOrder: revenue.length ? (spent / revenue.length).toFixed(2) : "0.00",
        firstOrderAt: dates[0] ? dates[0].toISOString() : null,
        lastOrderAt: dates.length ? dates[dates.length - 1]!.toISOString() : null,
      },
    })
  })
}
