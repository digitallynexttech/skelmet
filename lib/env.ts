import { z } from "zod"

/**
 * Validated once at boot from instrumentation.ts, so a missing variable fails
 * the process rather than the first request that needs it (§6).
 *
 * Deviation from the standard, deliberate and temporary: DATABASE_URL and
 * AUTH_SECRET are optional while the storefront runs from the catalogue
 * registry, so `pnpm build` and `pnpm start` work before Postgres exists.
 *
 *   ── FLIP THIS THE DAY THE DATABASE LANDS ──
 *   Set REQUIRE_BACKEND=1 in the deployment environment (or change the default
 *   below to `true`) and boot fails fast on a missing secret, exactly as §6
 *   intends. instrumentation.ts already warns loudly while it is off.
 */
const REQUIRE_BACKEND = process.env.REQUIRE_BACKEND === "1"

const backendVar = (name: string) =>
  REQUIRE_BACKEND
    ? z.string().min(1, `${name} is required once REQUIRE_BACKEND=1`)
    : z.string().min(1).optional()

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  DATABASE_URL: backendVar("DATABASE_URL"),
  AUTH_SECRET: backendVar("AUTH_SECRET"),
  AUTH_URL: z.url().optional(),

  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),

  PAYMENT_KEY_ID: z.string().optional(),
  PAYMENT_KEY_SECRET: z.string().optional(),
  PAYMENT_WEBHOOK_SECRET: z.string().optional(),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  MAIL_FROM: z.string().default("SKELMET <hello@skelmet.in>"),

  // Shiprocket. All optional: without them the console falls back to typing
  // the courier and AWB by hand, and the pincode check to the static promise.
  SHIPROCKET_API_URL: z.url().default("https://apiv2.shiprocket.in"),
  SHIPROCKET_EMAIL: z.string().optional(),
  SHIPROCKET_PASSWORD: z.string().optional(),
  SHIPROCKET_PICKUP_LOCATION: z.string().optional(),
  SHIPROCKET_WEBHOOK_TOKEN: z.string().optional(),

  CRON_SECRET: z.string().optional(),
  DISABLE_INLINE_SCHEDULER: z.string().optional(),
})

export type Env = z.infer<typeof schema>

let cached: Env | null = null

export function getEnv(): Env {
  if (cached) return cached

  const parsed = schema.safeParse(process.env)
  if (!parsed.success) {
    const flat = z.flattenError(parsed.error)
    console.error("[ENV] invalid environment", flat.fieldErrors)
    throw new Error("Environment validation failed: see the errors above.")
  }

  cached = parsed.data
  return cached
}

/** True once a real database is configured. Guards the DB-backed paths. */
export function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL)
}
