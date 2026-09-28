import "server-only"

import type { Prisma } from "@prisma/client"

import { formatMoney } from "@/lib/money"
import { db } from "@/server/db"

/**
 * The rules for using a coupon, shared by the cart's check and checkout so
 * the two cannot drift apart.
 */

/**
 * One answer for a code that does not exist, has expired or has run out.
 * Telling those apart let anyone walk a list of guesses and learn which
 * codes were real - and which were only used up, so worth trying later.
 */
export const COUPON_UNUSABLE = "This code can't be used."

/** The one refusal worth being specific about: the buyer can do something about it. */
export function minimumSpendMessage(minSubtotal: { toString(): string } | number): string {
  return `Spend at least ${formatMoney(Number(minSubtotal.toString()))} to use that code.`
}

/** Not expired and not used up, as of `now`. For the early, friendly check only. */
export function couponIsLive(
  coupon: { expiresAt: Date | null; maxUses: number | null; usedCount: number },
  now: Date = new Date(),
): boolean {
  if (coupon.expiresAt && coupon.expiresAt.getTime() <= now.getTime()) return false
  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) return false
  return true
}

/**
 * Takes one use of a coupon, only if it is still live - inside the order's
 * own transaction.
 *
 * The check used to run before the transaction and the increment inside it
 * unconditionally, so two buyers racing for the last use of a code both got
 * it, and a code that expired between the two still went through. One
 * conditional UPDATE is the check and the claim at once: false means another
 * order took the last use, or the code expired, and nothing was changed.
 */
export async function claimCouponUse(
  tx: Prisma.TransactionClient,
  couponId: string,
  now: Date = new Date(),
): Promise<boolean> {
  const claimed = await tx.coupon.updateMany({
    where: {
      id: couponId,
      AND: [
        { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
        { OR: [{ maxUses: null }, { usedCount: { lt: db.coupon.fields.maxUses } }] },
      ],
    },
    data: { usedCount: { increment: 1 } },
  })
  return claimed.count > 0
}
