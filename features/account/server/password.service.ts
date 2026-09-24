import "server-only"

import { changePasswordSchema } from "@/features/account/schemas/password.schema"
import { hashPassword, verifyPassword } from "@/lib/crypto"
import { hasDatabase } from "@/lib/env"
import { createAuditLog, getAuditMeta } from "@/server/audit"
import { requireSession } from "@/server/action-guard"
import { fail, ok, runAction, type ActionResult } from "@/server/action-result"
import { db } from "@/server/db"

/**
 * Lets someone change their own password, and clears `mustChangePassword`.
 *
 * That flag was already written by `createStaff` and `resetStaffPassword`,
 * carried through `authorize` onto the JWT and typed on the session - and read
 * by nothing at all. A staff member handed a temporary password was marked as
 * needing to change it and then never asked to, so the password an admin could
 * see stayed valid indefinitely. This and the gate in `app/(app)/layout.tsx`
 * are the two halves that make the flag mean something.
 *
 * Deliberately not under `/api/account`: `proxy.ts` fences that prefix to the
 * CUSTOMER population, and the people most likely to arrive here are staff.
 */
export async function changeOwnPassword(raw: unknown): Promise<ActionResult<{ ok: true }>> {
  return runAction(async () => {
    const session = await requireSession()
    if (!hasDatabase()) return fail("Not available.", undefined, 503)

    const input = changePasswordSchema.parse(raw)

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      // Overrides the global omit in server/db.ts - one of the few places the
      // hash is genuinely needed (§6).
      select: { id: true, passwordHash: true },
    })

    // No password set means this account signs in some other way, so there is
    // nothing here to replace.
    if (!user?.passwordHash) return fail("This account has no password to change.", undefined, 409)
    if (!(await verifyPassword(input.currentPassword, user.passwordHash))) {
      return fail("That is not your current password.", undefined, 422)
    }

    await db.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(input.newPassword),
        mustChangePassword: false,
      },
    })

    // Never log the password, old or new - only that it moved.
    await createAuditLog(session, {
      action: "user:password-change",
      module: "account",
      entityId: user.id,
      ...(await getAuditMeta()),
    })

    return ok({ ok: true as const })
  })
}
