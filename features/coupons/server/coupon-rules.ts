import "server-only"

import type { Prisma } from "@prisma/client"

import { formatMoney } from "@/lib/money"
import { db } from "@/server/db"

// Coupon rules shared by the cart's check and checkout, so they cannot drift.

/** One answer for missing, expired or used up, so guesses cannot learn which codes exist. */
export const COUPON_UNUSABLE = "This code can't be used."

/** The one specific refusal: the buyer can act on it. */
export function minimumSpendMessage(minSubtotal: { toString(): string } | number): string {
  return `Spend at least ${formatMoney(Number(minSubtotal.toString()))} to use that code.`
}

/** Not archived, expired or used up. The early check only; claimCouponUse is the real one. */
export function couponIsLive(
  coupon: {
    expiresAt: Date | null
    maxUses: number | null
    usedCount: number
    archivedAt?: Date | null
  },
  now: Date = new Date(),
): boolean {
  if (coupon.archivedAt) return false
  if (coupon.expiresAt && coupon.expiresAt.getTime() <= now.getTime()) return false
  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) return false
  return true
}

/**
 * Takes one use if the coupon is still live, inside the order's transaction.
 * One conditional UPDATE is check and claim at once, so two buyers cannot both
 * take the last use. False: nothing changed.
 */
export async function claimCouponUse(
  tx: Prisma.TransactionClient,
  couponId: string,
  now: Date = new Date(),
): Promise<boolean> {
  const claimed = await tx.coupon.updateMany({
    where: {
      id: couponId,
      archivedAt: null,
      AND: [
        { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
        { OR: [{ maxUses: null }, { usedCount: { lt: db.coupon.fields.maxUses } }] },
      ],
    },
    data: { usedCount: { increment: 1 } },
  })
  return claimed.count > 0
}
