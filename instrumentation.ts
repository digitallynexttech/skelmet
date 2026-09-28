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

  // No scheduler runs here: the work a cron would do (releasing unpaid orders,
  // deleting old visits) runs when a checkout starts or staff open the screen.
}
