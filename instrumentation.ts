/**
 * Boot hook: validate the environment so the process fails, not the first
 * request (§6).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return

  const { getEnv, hasDatabase } = await import("@/lib/env")
  getEnv()

  if (!hasDatabase()) {
    console.warn(
      "[BOOT] DATABASE_URL is not set - the storefront runs from the catalogue registry, and any database-backed route will answer 503.",
    )
  }

  // TODO(scheduler): start server/scheduler.ts here once queue draining exists,
  // guarded by DISABLE_INLINE_SCHEDULER so only one instance runs it (§6).
}
