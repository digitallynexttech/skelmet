import "server-only"

import { changePasswordSchema } from "@/features/account/schemas/password.schema"
import { hashPassword, verifyPassword } from "@/lib/crypto"
import { hasDatabase } from "@/lib/env"
import { createAuditLog, getAuditMeta } from "@/server/audit"
import { requireStaff } from "@/server/action-guard"
import { fail, ok, runAction, type ActionResult } from "@/server/action-result"
import { db } from "@/server/db"

/**
 * Changes the caller's own password and clears `mustChangePassword`. Bumps
 * `sessionVersion` so every other session ends; the form signs the caller back in.
 * Not under `/api/account`: proxy.ts fences that prefix to customers, and this is for staff.
 */
export async function changeOwnPassword(raw: unknown): Promise<ActionResult<{ ok: true }>> {
  return runAction(async () => {
    const session = await requireStaff({ allowPendingPasswordChange: true })
    if (!hasDatabase()) return fail("Not available.", undefined, 503)

    const input = changePasswordSchema.parse(raw)

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      // Overrides the global passwordHash omit in server/db.ts.
      select: { id: true, passwordHash: true },
    })

    if (!user?.passwordHash) return fail("This account has no password to change.", undefined, 409)
    if (!(await verifyPassword(input.currentPassword, user.passwordHash))) {
      return fail("That is not your current password.", undefined, 422)
    }

    await db.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(input.newPassword),
        mustChangePassword: false,
        sessionVersion: { increment: 1 },
      },
      select: { id: true },
    })

    // Never log the password, only that it changed.
    await createAuditLog(session, {
      action: "user:password-change",
      module: "account",
      entityId: user.id,
      ...(await getAuditMeta()),
    })

    return ok({ ok: true as const })
  })
}
