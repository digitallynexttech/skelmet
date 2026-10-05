import "server-only"

import { releaseStaleOrders } from "@/features/checkout/server/checkout.service"
import type { UnpaidOrderRow, UnpaidOrdersPayload } from "@/features/orders/hooks/use-orders"
import { cancelledByStaff } from "@/features/orders/server/cancellations"
import { MAX_PAGE_SIZE, PERMISSIONS } from "@/lib/constants"
import { hasDatabase } from "@/lib/env"
import { fail, ok, runAction, type ActionResult } from "@/server/action-result"
import { requirePermission } from "@/server/action-guard"
import { db } from "@/server/db"

/**
 * Orders placed and never paid for: the buyer filled in checkout, the order
 * was written, and the payment never landed.
 *
 * Unpaid orders do not stay "Awaiting payment" - after an hour they are
 * cancelled to give their stock back (releaseStaleOrders) - so most of these
 * sit under Cancelled on the orders board, looking like orders someone called
 * off. This list tells them apart, and says which of their buyers came back
 * and paid on another order, so nobody chases a sale that already happened.
 *
 * Orders paid online only - in full, or an advance. Cash on delivery was
 * never paid at checkout, so an unpaid COD order is a normal one waiting for
 * its parcel, not a lost sale.
 */

type Row = UnpaidOrderRow

export async function listUnpaidOrders(): Promise<ActionResult<UnpaidOrdersPayload>> {
  return runAction(async () => {
    await requirePermission(PERMISSIONS.ORDER_READ)
    if (!hasDatabase()) return fail("Database not configured.", undefined, 503)

    // So an hour-old unpaid order reads as expired here, as it does on the board.
    await releaseStaleOrders()

    const orders = await db.order.findMany({
      where: {
        paymentMethod: { in: ["ONLINE", "PARTIAL"] },
        status: { in: ["PENDING", "CANCELLED"] },
        placedAt: null,
        // A cancelled order that did take money is a refund question, not this.
        payments: { none: { status: { in: ["CAPTURED", "REFUNDED"] } } },
      },
      orderBy: { createdAt: "desc" },
      take: MAX_PAGE_SIZE,
      select: {
        id: true,
        number: true,
        status: true,
        email: true,
        phone: true,
        total: true,
        createdAt: true,
        shippingAddress: true,
        visitorId: true,
        visitor: { select: { source: true, deviceType: true } },
        items: { select: { nameSnapshot: true, qty: true } },
        payments: { select: { status: true } },
      },
    })

    // Who came back and paid. Matched on the email or the phone, since a
    // second attempt often corrects one of the two.
    const emails = [...new Set(orders.map((o) => o.email))]
    const phones = [...new Set(orders.map((o) => o.phone))]
    const paid = orders.length
      ? await db.order.findMany({
          where: {
            OR: [{ email: { in: emails } }, { phone: { in: phones } }],
            status: { notIn: ["PENDING", "CANCELLED"] },
          },
          select: { id: true, number: true, email: true, phone: true, createdAt: true },
          orderBy: { createdAt: "asc" },
        })
      : []

    // Cancelled by a person, or by the clock. Only the audit log knows.
    const byStaff = await cancelledByStaff(
      orders.filter((o) => o.status === "CANCELLED").map((o) => o.id),
    )

    const data: Row[] = orders.map((o) => {
      const address = (o.shippingAddress ?? {}) as {
        firstName?: string
        lastName?: string
        city?: string
        state?: string
      }
      const recovered = paid.find(
        (p) => (p.email === o.email || p.phone === o.phone) && p.createdAt > o.createdAt,
      )
      return {
        id: o.id,
        number: o.number,
        state: o.status === "PENDING" ? "open" : byStaff.has(o.id) ? "cancelled" : "expired",
        payment: o.payments.some((p) => p.status === "FAILED")
          ? "failed"
          : o.payments.length
            ? "closed"
            : "none",
        customer: [address.firstName, address.lastName].filter(Boolean).join(" ") || "Guest",
        firstName: address.firstName ?? "",
        email: o.email,
        phone: o.phone,
        city: [address.city, address.state].filter(Boolean).join(", "),
        items: o.items.map((i) => ({ name: i.nameSnapshot, qty: i.qty })),
        itemCount: o.items.reduce((n, i) => n + i.qty, 0),
        total: o.total.toString(),
        createdAt: o.createdAt.toISOString(),
        recoveredBy: recovered ? { id: recovered.id, number: recovered.number } : null,
        visitorId: o.visitorId,
        source: o.visitor?.source ?? null,
        deviceType: o.visitor?.deviceType ?? null,
      }
    })

    // Lost: past its hour and not paid for since. An order still inside its
    // hour may yet be paid, so it is not counted lost, whatever else it is.
    const lost = data.filter((r) => !r.recoveredBy && r.state !== "open")
    return ok({
      data,
      summary: {
        open: data.filter((r) => r.state === "open").length,
        lost: lost.length,
        recovered: data.filter((r) => r.recoveredBy).length,
        lostValue: lost.reduce((sum, r) => sum + Number(r.total), 0).toFixed(2),
      },
    })
  })
}
