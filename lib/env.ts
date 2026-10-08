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
 *
 * An empty value counts as unset. `.env.example` is copied with its blanks,
 * and `DATABASE_URL=""` used to fail validation - so every page answered 500
 * - rather than boot without a database as the example says it will.
 */
const REQUIRE_BACKEND = process.env.REQUIRE_BACKEND === "1"

/** "" and whitespace are "not set", so the schema's own default or optional applies. */
const blank = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value

const optionalString = () => z.preprocess(blank, z.string().optional())

const backendVar = (name: string) =>
  REQUIRE_BACKEND
    ? z.preprocess(blank, z.string({ error: `${name} is required once REQUIRE_BACKEND=1` }).min(1))
    : z.preprocess(blank, z.string().min(1).optional())

const schema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

    DATABASE_URL: backendVar("DATABASE_URL"),
    AUTH_SECRET: backendVar("AUTH_SECRET"),
    AUTH_URL: z.preprocess(blank, z.url().optional()),

    NEXT_PUBLIC_SITE_URL: z.preprocess(blank, z.url().default("http://localhost:3000")),

    PAYMENT_KEY_ID: optionalString(),
    PAYMENT_KEY_SECRET: optionalString(),
    PAYMENT_WEBHOOK_SECRET: optionalString(),

    // Mail goes out by the first of these that takes it (lib/mailer.ts):
    // Brevo's API, Brevo's SMTP relay, then the shop's own SMTP account.
    BREVO_API_KEY: optionalString(),
    BREVO_SMTP_LOGIN: optionalString(),
    BREVO_SMTP_KEY: optionalString(),
    // Brevo's sender: an address on a domain authenticated in Brevo.
    BREVO_FROM: z.preprocess(blank, z.string().default("SKELMET <no-reply@skelmet.in>")),

    SMTP_HOST: optionalString(),
    SMTP_PORT: z.preprocess(blank, z.coerce.number().int().positive().default(587)),
    SMTP_USER: optionalString(),
    SMTP_PASSWORD: optionalString(),
    // The mailbox the shop actually sends from. Gmail refuses to send as an
    // address it cannot prove the account owns, so a default on the shop's
    // own domain got every message rejected until someone noticed.
    MAIL_FROM: z.preprocess(blank, z.string().default("SKELMET <skelmetindia@gmail.com>")),
    // Where replies go, on every route. A no-reply sender's own replies go
    // nowhere; unset, a reply goes to the sender.
    MAIL_REPLY_TO: optionalString(),

    // Shiprocket. All optional: without them the console falls back to typing
    // the courier and AWB by hand, and the pincode check to the static promise.
    SHIPROCKET_API_URL: z.preprocess(blank, z.url().default("https://apiv2.shiprocket.in")),
    SHIPROCKET_EMAIL: optionalString(),
    SHIPROCKET_PASSWORD: optionalString(),
    SHIPROCKET_PICKUP_LOCATION: optionalString(),
    SHIPROCKET_WEBHOOK_TOKEN: optionalString(),

    // The blog. The console's Blog page needs it, with the Editor role, to
    // read drafts and to publish; the site itself reads a public dataset
    // without one. The project is named in config/site.ts.
    SANITY_API_TOKEN: optionalString(),
  })
  .superRefine((env, ctx) => {
    // The database holds staff logins, and sessions are signed with this: a
    // database without it is a console nobody can sign in to, and settings
    // secrets that cannot be sealed.
    if (env.DATABASE_URL && !env.AUTH_SECRET) {
      ctx.addIssue({
        code: "custom",
        path: ["AUTH_SECRET"],
        message: "AUTH_SECRET is required whenever DATABASE_URL is set",
      })
    }
  })

export type Env = z.infer<typeof schema>

/**
 * Why the site's own address is wrong for production, or null when it is
 * fine. Every link in every email, the Razorpay and Shiprocket webhook URLs
 * the console shows, and whether cookies are Secure all come from it, and
 * the default is localhost.
 */
export function siteUrlProblem(raw: Record<string, string | undefined>): string | null {
  if (raw.NODE_ENV !== "production") return null
  const value = raw.NEXT_PUBLIC_SITE_URL?.trim()
  if (!value) return "NEXT_PUBLIC_SITE_URL is not set"
  let host: string
  try {
    host = new URL(value).hostname
  } catch {
    return `NEXT_PUBLIC_SITE_URL is not a URL: ${value}`
  }
  if (["localhost", "127.0.0.1", "[::1]", "::1", "0.0.0.0"].includes(host)) {
    return `NEXT_PUBLIC_SITE_URL points at ${host}`
  }
  return null
}

let cached: Env | null = null

export function getEnv(): Env {
  if (cached) return cached

  const parsed = schema.safeParse(process.env)
  if (!parsed.success) {
    const flat = z.flattenError(parsed.error)
    console.error("[ENV] invalid environment", flat.fieldErrors)
    throw new Error("Environment validation failed: see the errors above.")
  }

  const problem = siteUrlProblem(process.env)
  if (problem) {
    console.error(
      `[ENV] ${problem} in production. Links in customer emails, the webhook URLs shown in Settings and Secure cookies all depend on it - set it to https://skelmet.in.`,
    )
  }

  cached = parsed.data
  return cached
}

/** True once a real database is configured. Guards the DB-backed paths. */
export function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim())
}
