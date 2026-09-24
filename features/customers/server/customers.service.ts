import "server-only"

import type { Prisma } from "@prisma/client"

import type { AddressInput } from "@/features/checkout/schemas/checkout.schema"
import { PERMISSIONS } from "@/lib/constants"
import { hasDatabase } from "@/lib/env"
import { fail, ok, runAction, type ActionResult } from "@/server/action-result"
import { requirePermission } from "@/server/action-guard"
import { db } from "@/server/db"

/**
 * Customers are a by-product of orders, not accounts.
 *
 * Nobody signs up here - checkout is the only thing that ever creates one of
 * these rows. The point is that the shop knows who has bought before, so the
 * admin console can show a customer list and a returning buyer does not have
 * to retype an address they have already given us.
 *
 * The row is deliberately thin: no password, no session, nothing to sign in
 * with. `kind` stays CUSTOMER and these accounts hold no roles, so none of
 * this widens what the staff console can be reached with.
 */

/**
 * Upserts the customer behind an order and returns their id.
 *
 * Runs INSIDE the order transaction: a customer record for an order that then
 * failed to write would be a person who never bought anything.
 */
export async function attachCustomer(
  tx: Prisma.TransactionClient,
  input: { email: string; phone: string; address: AddressInput },
): Promise<string> {
  const email = input.email.toLowerCase()
  const name = `${input.address.firstName} ${input.address.lastName}`.trim()

  const existing = await tx.user.findUnique({
    where: { email },
    select: { id: true, name: true, phone: true },
  })

  // `kind` is never written on an existing row. A staff member ordering with
  // their work address must not be demoted to CUSTOMER, and - far worse - a
  // customer must never be handed STAFF by typing an address that happens to
  // match one. Existing names and numbers are only filled in where blank, so
  // a checkout form cannot rewrite an admin's own details.
  const user = existing
    ? await tx.user.update({
        where: { id: existing.id },
        data: {
          name: existing.name ?? (name || null),
          phone: existing.phone ?? input.phone,
        },
        select: { id: true },
      })
    : await tx.user.create({
        data: { email, kind: "CUSTOMER", name: name || null, phone: input.phone },
        select: { id: true },
      })

  // One address per customer, overwritten by the most recent order rather than
  // accumulating a list. There is no account screen to choose between them, so
  // a pile of old addresses would only be a way to ship to the wrong one.
  const current = await tx.address.findFirst({
    where: { userId: user.id, isDefault: true },
    select: { id: true },
  })

  const fields = {
    name,
    line1: input.address.line1,
    line2: input.address.line2 || null,
    city: input.address.city,
    state: input.address.state,
    pincode: input.address.pincode,
    phone: input.phone,
  }

  if (current) await tx.address.update({ where: { id: current.id }, data: fields })
  else await tx.address.create({ data: { ...fields, userId: user.id, isDefault: true } })

  return user.id
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

/**
 * The admin customer list. Staff accounts are excluded: they are colleagues
 * with console logins, not people who bought a skull, and mixing them into a
 * customer list is how someone ends up emailing a marketing blast to the
 * owner's own admin address.
 */
export async function listCustomers(
  params: { page?: number; pageSize?: number; search?: string } = {},
): Promise<ActionResult<{ data: CustomerRow[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } }>> {
  return runAction(async () => {
    await requirePermission(PERMISSIONS.ORDER_READ)
    if (!hasDatabase()) return fail("Database not configured.", undefined, 503)

    const page = Math.max(1, params.page ?? 1)
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20))
    const search = params.search?.trim()

    const where: Prisma.UserWhereInput = {
      kind: "CUSTOMER",
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
            // Cancelled and refunded orders still happened, but they are not
            // money the shop kept, so they do not count toward spend.
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
        // Money is a string on the wire (§7).
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

/**
 * One customer, with everything the console knows about them.
 *
 * Gated on ORDER_READ, the same scope as the list it is reached from: this is
 * the personal data already on an order, grouped by the person rather than by
 * the purchase, so it needs no scope of its own.
 *
 * Staff are excluded here as they are from the list. A colleague's console
 * account is not a customer record, and letting /admin/customers/<id> render
 * one would turn a customer screen into a directory of staff addresses.
 */
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

    // Every order is listed, including the cancelled ones — they are part of
    // this person's history. Only the kept money counts toward spend.
    const revenue = user.orders.filter((o) => !NOT_REVENUE.has(o.status))
    const spent = revenue.reduce((sum, o) => sum + Number(o.total), 0)
    const dates = user.orders.map((o) => o.placedAt ?? o.createdAt).sort((a, b) => a.getTime() - b.getTime())

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
        // Money is a string on the wire (§7).
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
