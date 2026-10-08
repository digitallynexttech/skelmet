// Validates the environment at boot, so the process fails, not a request.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return

  const { getEnv, hasDatabase } = await import("@/lib/env")
  getEnv()

  if (!hasDatabase()) {
    console.warn(
      "[BOOT] DATABASE_URL is not set - the storefront runs from the catalogue registry, and any database-backed route will answer 503.",
    )
  }

  // No scheduler: cron-like work runs when a checkout starts or staff open the screen.
}
