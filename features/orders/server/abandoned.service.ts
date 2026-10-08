import "server-only"

import { releaseStaleOrders } from "@/features/checkout/server/checkout.service"
import type { UnpaidOrderRow, UnpaidOrdersPayload } from "@/features/orders/hooks/use-orders"
import { cancelledByStaff } from "@/features/orders/server/cancellations"
import { MAX_PAGE_SIZE, PERMISSIONS } from "@/lib/constants"
import { hasDatabase } from "@/lib/env"
import { fail, ok, runAction, type ActionResult } from "@/server/action-result"
import { requirePermission } from "@/server/action-guard"
import { db } from "@/server/db"

// Online (or advance) orders whose payment never landed; they expire to CANCELLED
// after an hour. Says which buyers paid on a later order. Unpaid COD is normal, so excluded.

type Row = UnpaidOrderRow

export async function listUnpaidOrders(): Promise<ActionResult<UnpaidOrdersPayload>> {
  return runAction(async () => {
    await requirePermission(PERMISSIONS.ORDER_READ)
    if (!hasDatabase()) return fail("Database not configured.", undefined, 503)

    await releaseStaleOrders()

    const orders = await db.order.findMany({
      where: {
        paymentMethod: { in: ["ONLINE", "PARTIAL"] },
        status: { in: ["PENDING", "CANCELLED"] },
        placedAt: null,
        // One that took money is a refund question.
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

    // Email or phone: a second attempt often corrects one of them.
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

    // Only the audit log knows a person from the clock.
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

    // An order still inside its hour may yet be paid, so it is never lost.
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
