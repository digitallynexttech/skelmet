import { afterEach, describe, expect, it, vi } from "vitest"

/**
 * Boot validation. Copying .env.example as it stands has to boot, and the
 * combinations that cannot work have to fail at boot rather than at the first
 * request that needs them.
 */

const original = { ...process.env }

async function load(env: Record<string, string | undefined>) {
  process.env = { NODE_ENV: "test", ...env } as NodeJS.ProcessEnv
  vi.resetModules()
  return import("@/lib/env")
}

afterEach(() => {
  process.env = { ...original }
  vi.restoreAllMocks()
})

describe("getEnv", () => {
  it("treats empty values as unset, so the copied example boots", async () => {
    const { getEnv, hasDatabase } = await load({
      DATABASE_URL: "",
      AUTH_SECRET: "",
      AUTH_URL: "",
      SMTP_PORT: "",
      MAIL_FROM: "",
      SHIPROCKET_API_URL: "",
    })
    const env = getEnv()
    expect(env.DATABASE_URL).toBeUndefined()
    expect(env.AUTH_URL).toBeUndefined()
    expect(env.SMTP_PORT).toBe(587)
    expect(env.SHIPROCKET_API_URL).toBe("https://apiv2.shiprocket.in")
    expect(hasDatabase()).toBe(false)
  })

  it("sends as the shop's real mailbox by default", async () => {
    const { getEnv } = await load({})
    expect(getEnv().MAIL_FROM).toBe("SKELMET <skelmetindia@gmail.com>")
  })

  it("refuses a database without AUTH_SECRET", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    const { getEnv } = await load({ DATABASE_URL: "postgresql://x@localhost/db", AUTH_SECRET: "" })
    expect(() => getEnv()).toThrow(/Environment validation failed/)
  })

  it("accepts a database with its secret", async () => {
    const { getEnv } = await load({
      DATABASE_URL: "postgresql://x@localhost/db",
      AUTH_SECRET: "s3cret",
    })
    expect(getEnv().AUTH_SECRET).toBe("s3cret")
  })

  it("no longer carries the variables nothing read", async () => {
    const { getEnv } = await load({ CRON_SECRET: "x", DISABLE_INLINE_SCHEDULER: "1" })
    expect(getEnv()).not.toHaveProperty("CRON_SECRET")
    expect(getEnv()).not.toHaveProperty("DISABLE_INLINE_SCHEDULER")
  })
})

describe("siteUrlProblem", () => {
  it("says nothing outside production", async () => {
    const { siteUrlProblem } = await load({})
    expect(siteUrlProblem({ NODE_ENV: "development" })).toBeNull()
  })

  it("flags a missing or localhost address in production", async () => {
    const { siteUrlProblem } = await load({})
    expect(siteUrlProblem({ NODE_ENV: "production" })).toMatch(/not set/)
    expect(
      siteUrlProblem({ NODE_ENV: "production", NEXT_PUBLIC_SITE_URL: "http://localhost:3000" }),
    ).toMatch(/localhost/)
    expect(
      siteUrlProblem({ NODE_ENV: "production", NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3000" }),
    ).toMatch(/127\.0\.0\.1/)
    expect(
      siteUrlProblem({ NODE_ENV: "production", NEXT_PUBLIC_SITE_URL: "https://skelmet.in" }),
    ).toBeNull()
  })

  it("is logged loudly at boot in production", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    const { getEnv } = await load({ NODE_ENV: "production" })
    getEnv()
    expect(error).toHaveBeenCalledWith(expect.stringContaining("NEXT_PUBLIC_SITE_URL"))
  })
})
