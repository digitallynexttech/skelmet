import { z } from "zod"

// Validated at boot (instrumentation.ts). DATABASE_URL and AUTH_SECRET are
// optional unless REQUIRE_BACKEND=1, which production must set.
const REQUIRE_BACKEND = process.env.REQUIRE_BACKEND === "1"

/** "" and whitespace are unset, so `.env.example`'s blanks get the default. */
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

    // Mail routes in order (lib/mailer.ts): Brevo API, Brevo SMTP, then SMTP_*.
    BREVO_API_KEY: optionalString(),
    BREVO_SMTP_LOGIN: optionalString(),
    BREVO_SMTP_KEY: optionalString(),
    // Must be on a domain authenticated in Brevo.
    BREVO_FROM: z.preprocess(blank, z.string().default("SKELMET <no-reply@skelmet.in>")),

    SMTP_HOST: optionalString(),
    SMTP_PORT: z.preprocess(blank, z.coerce.number().int().positive().default(587)),
    SMTP_USER: optionalString(),
    SMTP_PASSWORD: optionalString(),
    // Must be the Gmail account's own mailbox, or Gmail rejects every message.
    MAIL_FROM: z.preprocess(blank, z.string().default("SKELMET <skelmetindia@gmail.com>")),
    // Unset, replies go to the sender.
    MAIL_REPLY_TO: optionalString(),

    // Optional: without them couriers are typed by hand and the pincode check
    // uses the static promise.
    SHIPROCKET_API_URL: z.preprocess(blank, z.url().default("https://apiv2.shiprocket.in")),
    SHIPROCKET_EMAIL: optionalString(),
    SHIPROCKET_PASSWORD: optionalString(),
    SHIPROCKET_PICKUP_LOCATION: optionalString(),
    SHIPROCKET_WEBHOOK_TOKEN: optionalString(),

    // Editor role, for the console's Blog page; a public dataset needs none.
    SANITY_API_TOKEN: optionalString(),
  })
  .superRefine((env, ctx) => {
    // Signs sessions and seals settings secrets: a database is useless without it.
    if (env.DATABASE_URL && !env.AUTH_SECRET) {
      ctx.addIssue({
        code: "custom",
        path: ["AUTH_SECRET"],
        message: "AUTH_SECRET is required whenever DATABASE_URL is set",
      })
    }
  })

export type Env = z.infer<typeof schema>

/** Why NEXT_PUBLIC_SITE_URL is wrong for production, or null. Defaults to localhost. */
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

/** Guards the DB-backed paths. */
export function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim())
}
